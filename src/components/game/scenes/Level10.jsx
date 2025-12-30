import Phaser from 'phaser';

export default class Level10 extends Phaser.Scene {
    constructor() {
        super({ key: 'Level10' });
    }

    create() {
        // --- Constants ---
        this.GRID_SIZE = 21;
        this.TILE_SIZE = Math.min(this.scale.width, this.scale.height) / this.GRID_SIZE;
        this.DISPLAY_TIME = 7000;
        this.TOTAL_SYMBOLS = 5;

        // --- State ---
        this.playerPos = { x: 10, y: 10 };
        this.grid = []; 
        this.tileSprites = []; 
        this.tileTexts = [];
        this.physicsEnabled = false;
        
        this.isMoving = false;
        this.lives = 999; // Infinite for testing
        this.isGameOver = false;
        this.isWon = false;
        
        this.showingPattern = true;
        this.symbolSequence = [];
        this.symbolPositions = [];
        this.currentCollectIndex = 0;
        
        // Hazards
        this.fluxActive = false;
        this.fluxDirection = null; // 'N', 'S', 'E', 'W'
        this.fluxPosition = 0;
        this.fluxSafeRows = []; // Safe rows for flux
        this.cannonActive = false;
        this.projectiles = [];
        this.cannonPositions = []; // Multiple cannons
        this.glitchActive = false;
        this.glitches = [];
        this.movingWallsActive = false;
        this.snakeActive = false;
        this.snake = [];
        this.snake2 = [];
        this.snakeSprites = [];
        this.snake2Sprites = [];
        
        this.currentRotation = 0;
        
        this.cameras.main.setBackgroundColor('#000000');
        
        this.generateSymbolSequence();
        this.generateGrid();
        this.drawGrid();
        this.setupPlayer();
        this.setupInputs();
        this.showPatternDisplay();
        this.updateUI();
        
        this.time.delayedCall(this.DISPLAY_TIME, () => {
            this.hidePatternDisplay();
            this.placeSymbolsOnGrid();
        });
        
        // Setup timers
        this.time.addEvent({
            delay: 400, // Much slower flux
            callback: this.updateHazards,
            callbackScope: this,
            loop: true
        });
        
        this.time.addEvent({
            delay: 2500,
            callback: this.shootCannon,
            callbackScope: this,
            loop: true
        });
        
        this.time.addEvent({
            delay: 500,
            callback: this.moveSnake,
            callbackScope: this,
            loop: true
        });
        
        // Rotazione ogni 15 secondi
        this.time.addEvent({
            delay: 15000,
            callback: this.rotateWorld,
            callbackScope: this,
            loop: true
        });
    }
    
    rotateWorld() {
        if (this.isGameOver || this.isWon || this.showingPattern) return;
        
        this.currentRotation += 90;
        this.tweens.add({
            targets: this.cameras.main,
            rotation: Phaser.Math.DegToRad(this.currentRotation),
            duration: 1000,
            ease: 'Cubic.easeOut'
        });
    }
    
    generateSymbolSequence() {
        const symbols = ['♥', '★', '■', '◆', '●'];
        this.symbolSequence = [...symbols].sort(() => Math.random() - 0.5);
    }
    
    showPatternDisplay() {
        const startY = 80;
        const centerX = this.scale.width / 2;
        
        this.patternTitle = this.add.text(centerX, startY - 30, '⚡ LIVELLO FINALE ⚡', {
            fontFamily: 'monospace',
            fontSize: '28px',
            color: '#ff0000',
            fontStyle: 'bold',
            align: 'center'
        }).setOrigin(0.5).setDepth(100);
        
        const row1Text = this.symbolSequence.join('  ');
        this.patternRow1 = this.add.text(centerX, startY + 30, row1Text, {
            fontFamily: 'monospace',
            fontSize: '44px',
            color: '#06b6d4',
            fontStyle: 'bold',
            align: 'center'
        }).setOrigin(0.5).setDepth(100);
        
        const row2Text = Array.from({length: this.TOTAL_SYMBOLS}, (_, i) => i).join('  ');
        this.patternRow2 = this.add.text(centerX, startY + 80, row2Text, {
            fontFamily: 'monospace',
            fontSize: '28px',
            color: '#ffffff',
            fontStyle: 'bold',
            align: 'center'
        }).setOrigin(0.5).setDepth(100);
        
        this.countdownText = this.add.text(centerX, startY + 140, '7', {
            fontFamily: 'monospace',
            fontSize: '48px',
            color: '#ff0000',
            fontStyle: 'bold',
            align: 'center'
        }).setOrigin(0.5).setDepth(100);
        
        let timeLeft = 7;
        this.countdownTimer = this.time.addEvent({
            delay: 1000,
            callback: () => {
                timeLeft--;
                if (this.countdownText) {
                    this.countdownText.setText(timeLeft > 0 ? timeLeft.toString() : '');
                }
            },
            repeat: 6
        });
        
        this.tweens.add({
            targets: this.patternTitle,
            scale: { from: 1, to: 1.1 },
            duration: 500,
            yoyo: true,
            repeat: -1
        });
    }
    
    hidePatternDisplay() {
        this.showingPattern = false;
        if (this.patternTitle) this.patternTitle.destroy();
        if (this.patternRow1) this.patternRow1.destroy();
        if (this.patternRow2) this.patternRow2.destroy();
        if (this.countdownText) this.countdownText.destroy();
    }
    
    generateGrid() {
        this.grid = Array(this.GRID_SIZE).fill().map(() => Array(this.GRID_SIZE).fill(0));
        
        for (let y = 0; y < this.GRID_SIZE; y++) {
            for (let x = 0; x < this.GRID_SIZE; x++) {
                if (Math.random() < 0.15) this.grid[y][x] = 1;
            }
        }

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

        this.grid[10][10] = 0;
    }
    
    placeSymbolsOnGrid() {
        this.symbolPositions = [];
        
        for (let i = 0; i < this.TOTAL_SYMBOLS; i++) {
            let placed = false;
            let attempts = 0;
            while (!placed && attempts < 100) {
                const rx = Math.floor(Math.random() * this.GRID_SIZE);
                const ry = Math.floor(Math.random() * this.GRID_SIZE);
                
                if (this.grid[ry][rx] === 0 && 
                    !this.isFinderZone(rx, ry) && 
                    !(rx === 10 && ry === 10) &&
                    !this.symbolPositions.some(s => s.x === rx && s.y === ry)) {
                    
                    this.symbolPositions.push({
                        symbol: this.symbolSequence[i],
                        x: rx,
                        y: ry,
                        index: i
                    });
                    
                    this.grid[ry][rx] = 20 + i;
                    this.updateTileVisual(rx, ry);
                    placed = true;
                }
                attempts++;
            }
        }
    }
    
    isFinderZone(x, y) {
        if (x <= 6 && y <= 6) return true;
        if (x >= this.GRID_SIZE - 7 && y <= 6) return true;
        if (x <= 6 && y >= this.GRID_SIZE - 7) return true;
        return false;
    }

    drawGrid() {
        this.tileSprites = [];
        this.tileTexts = [];
        const size = this.TILE_SIZE - 1;
        
        for (let y = 0; y < this.GRID_SIZE; y++) {
            const rowSprites = [];
            const rowTexts = [];
            for (let x = 0; x < this.GRID_SIZE; x++) {
                const cx = x * this.TILE_SIZE + this.TILE_SIZE / 2;
                const cy = y * this.TILE_SIZE + this.TILE_SIZE / 2;
                
                const rect = this.add.rectangle(cx, cy, size, size, 0xffffff);
                rect.setData('gridX', x);
                rect.setData('gridY', y);
                rowSprites.push(rect);
                
                const text = this.add.text(cx, cy, '', {
                    fontFamily: 'monospace',
                    fontSize: `${size * 0.65}px`,
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

    updateTileVisual(x, y) {
        if (x < 0 || x >= this.GRID_SIZE || y < 0 || y >= this.GRID_SIZE) return;
        this.updateTileVisualByObj(this.tileSprites[y][x], this.tileTexts[y][x], this.grid[y][x]);
    }

    updateTileVisualByObj(rect, text, type) {
        text.setText('');
        
        if (type === 1) {
            rect.setFillStyle(0x333333);
            rect.setDepth(0);
        } else if (type === 4) {
            rect.setFillStyle(0xff0000); // Flux
            rect.setDepth(5);
        } else if (type === 5) {
            rect.setFillStyle(0xff00ff); // Glitch
            rect.setDepth(5);
        } else if (type >= 20 && type <= 30) {
            const symbolIndex = type - 20;
            const symbol = this.symbolSequence[symbolIndex];
            rect.setFillStyle(0x7c3aed);
            text.setText(symbol);
            text.setColor('#ffffff');
            text.setFontSize(`${this.TILE_SIZE * 0.8}px`);
            rect.setDepth(0);
        } else {
            rect.setFillStyle(0x0a0a0a);
            rect.setDepth(0);
        }
    }

    setupPlayer() {
        this.player = this.add.rectangle(
            this.playerPos.x * this.TILE_SIZE + this.TILE_SIZE / 2,
            this.playerPos.y * this.TILE_SIZE + this.TILE_SIZE / 2,
            this.TILE_SIZE - 2,
            this.TILE_SIZE - 2,
            0x9333ea
        );
        this.player.setDepth(10);
        
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
        if (this.isMoving || this.isGameOver || this.isWon || this.showingPattern) return;

        // Converti input screen in grid direction considerando la rotazione
        const rad = -this.cameras.main.rotation;
        const gridDx = Math.round(dx * Math.cos(rad) - dy * Math.sin(rad));
        const gridDy = Math.round(dx * Math.sin(rad) + dy * Math.cos(rad));

        if (gridDx > 0) this.playerSymbol.setText('>');
        else if (gridDx < 0) this.playerSymbol.setText('<');
        else if (gridDy > 0) this.playerSymbol.setText('v');
        else if (gridDy < 0) this.playerSymbol.setText('^');
        
        this.attemptMove(gridDx, gridDy);
    }
    
    attemptMove(dx, dy) {
        let nextX = this.playerPos.x + dx;
        let nextY = this.playerPos.y + dy;

        if (nextX < 0) nextX = this.GRID_SIZE - 1;
        if (nextX >= this.GRID_SIZE) nextX = 0;
        if (nextY < 0) nextY = this.GRID_SIZE - 1;
        if (nextY >= this.GRID_SIZE) nextY = 0;

        const cell = this.grid[nextY][nextX];
        
        if (cell === 1) return; 

        this.isMoving = true;
        
        if (cell >= 20 && cell <= 30) {
            const symbolIndex = cell - 20;
            
            if (symbolIndex === this.currentCollectIndex) {
                this.game.events.emit('play-sound', 'collect');
                this.currentCollectIndex++;
                this.grid[nextY][nextX] = 0;
                this.updateTileVisual(nextX, nextY);
                
                // EFFETTO SPECIALE!
                this.triggerWorldEffect(this.currentCollectIndex);
                
                if (this.currentCollectIndex >= this.TOTAL_SYMBOLS) {
                    this.handleWin();
                    return;
                }
            } else {
                this.handleDamage();
            }
        }

        this.playerPos = { x: nextX, y: nextY };
        
        this.tweens.add({
            targets: [this.player, this.playerSymbol],
            x: nextX * this.TILE_SIZE + this.TILE_SIZE / 2,
            y: nextY * this.TILE_SIZE + this.TILE_SIZE / 2,
            duration: 150,
            ease: 'Power2',
            onComplete: () => {
                this.isMoving = false;
            }
        });
    }
    
    triggerWorldEffect(symbolIndex) {
        // Effetto positivo di raccolta simbolo (non danno)
        this.cameras.main.flash(300, 0, 255, 100);
        
        if (symbolIndex === 1) {
            // FASE 1: LIBERA - nessuna difficoltà
            this.cameras.main.setBackgroundColor('#000000');
            
        } else if (symbolIndex === 2) {
            // FASE 2: FLUSSO ROSSO lento con 3 righe sicure RANDOM
            this.fluxActive = true;
            const dirs = ['N', 'S', 'E', 'W'];
            this.fluxDirection = dirs[Math.floor(Math.random() * dirs.length)];
            this.fluxPosition = 0;
            
            // 3 righe/colonne sicure random NON consecutive
            const allRows = Array.from({length: this.GRID_SIZE}, (_, i) => i);
            this.fluxSafeRows = [];
            for (let i = 0; i < 3; i++) {
                const idx = Math.floor(Math.random() * allRows.length);
                this.fluxSafeRows.push(allRows[idx]);
                allRows.splice(idx, 1);
            }
            
            this.cameras.main.setBackgroundColor('#1a0000');
            
        } else if (symbolIndex === 3) {
            // FASE 3: SPARI DA CANNONE DA TUTTE LE DIREZIONI
            this.fluxActive = false;
            this.cannonActive = true;
            this.cannonPositions = [
                {x: 3, y: 3},     // Top-left
                {x: 17, y: 3},    // Top-right
                {x: 3, y: 17},    // Bottom-left
                {x: 17, y: 17}    // Bottom-right
            ];
            this.cameras.main.setBackgroundColor('#001a00');
            
        } else if (symbolIndex === 4) {
            // FASE 4: FLUSSO + SPARI + 2 SERPENTI
            this.cannonActive = true;
            this.cannonPositions = [{x: 3, y: 3}];
            
            this.snakeActive = true;
            this.spawnSnake();
            this.spawnSnake2();
            
            this.fluxActive = true;
            const dirs = ['N', 'S', 'E', 'W'];
            this.fluxDirection = dirs[Math.floor(Math.random() * dirs.length)];
            this.fluxPosition = 0;
            const allRows = Array.from({length: this.GRID_SIZE}, (_, i) => i);
            this.fluxSafeRows = [];
            for (let i = 0; i < 3; i++) {
                const idx = Math.floor(Math.random() * allRows.length);
                this.fluxSafeRows.push(allRows[idx]);
                allRows.splice(idx, 1);
            }
            
            this.cameras.main.setBackgroundColor('#1a0000');
            
        } else if (symbolIndex === 5) {
            // FASE 5: TUTTO INSIEME - FINALE
            this.cannonActive = true;
            this.cannonPositions = [
                {x: 3, y: 3},
                {x: 17, y: 3},
                {x: 3, y: 17},
                {x: 17, y: 17}
            ];
            
            this.snakeActive = true;
            if (this.snake.length === 0) this.spawnSnake();
            if (this.snake2.length === 0) this.spawnSnake2();
            
            this.fluxActive = true;
            const dirs = ['N', 'S', 'E', 'W'];
            this.fluxDirection = dirs[Math.floor(Math.random() * dirs.length)];
            this.fluxPosition = 0;
            this.fluxSafeRows = [10];
            
            this.cameras.main.setBackgroundColor('#1a0000');
        }
    }
    
    updateHazards() {
        if (this.isGameOver || this.isWon || this.showingPattern) return;
        
        // Update flux
        if (this.fluxActive) {
            this.fluxPosition++;
            
            // Update grid cells based on flux
            if (this.fluxDirection === 'E') {
                if (this.fluxPosition < this.GRID_SIZE) {
                    for (let y = 0; y < this.GRID_SIZE; y++) {
                        // Skip safe rows
                        if (this.fluxSafeRows.includes(y)) continue;
                        
                        if (this.grid[y][this.fluxPosition] === 0) {
                            this.grid[y][this.fluxPosition] = 4; // Flux
                            this.updateTileVisual(this.fluxPosition, y);
                        }
                        // Check player hit
                        if (this.playerPos.x === this.fluxPosition && this.playerPos.y === y) {
                            this.handleDamage();
                        }
                    }
                } else {
                    this.fluxActive = false;
                    // Clear flux
                    for (let y = 0; y < this.GRID_SIZE; y++) {
                        for (let x = 0; x < this.GRID_SIZE; x++) {
                            if (this.grid[y][x] === 4) {
                                this.grid[y][x] = 0;
                                this.updateTileVisual(x, y);
                            }
                        }
                    }
                }
            } else if (this.fluxDirection === 'W') {
                const pos = this.GRID_SIZE - 1 - this.fluxPosition;
                if (pos >= 0) {
                    for (let y = 0; y < this.GRID_SIZE; y++) {
                        if (this.fluxSafeRows.includes(y)) continue;
                        
                        if (this.grid[y][pos] === 0) {
                            this.grid[y][pos] = 4;
                            this.updateTileVisual(pos, y);
                        }
                        if (this.playerPos.x === pos && this.playerPos.y === y) {
                            this.handleDamage();
                        }
                    }
                } else {
                    this.fluxActive = false;
                    for (let y = 0; y < this.GRID_SIZE; y++) {
                        for (let x = 0; x < this.GRID_SIZE; x++) {
                            if (this.grid[y][x] === 4) {
                                this.grid[y][x] = 0;
                                this.updateTileVisual(x, y);
                            }
                        }
                    }
                }
            } else if (this.fluxDirection === 'S') {
                if (this.fluxPosition < this.GRID_SIZE) {
                    for (let x = 0; x < this.GRID_SIZE; x++) {
                        if (this.fluxSafeRows.includes(x)) continue;
                        
                        if (this.grid[this.fluxPosition][x] === 0) {
                            this.grid[this.fluxPosition][x] = 4;
                            this.updateTileVisual(x, this.fluxPosition);
                        }
                        if (this.playerPos.y === this.fluxPosition && this.playerPos.x === x) {
                            this.handleDamage();
                        }
                    }
                } else {
                    this.fluxActive = false;
                    for (let y = 0; y < this.GRID_SIZE; y++) {
                        for (let x = 0; x < this.GRID_SIZE; x++) {
                            if (this.grid[y][x] === 4) {
                                this.grid[y][x] = 0;
                                this.updateTileVisual(x, y);
                            }
                        }
                    }
                }
            } else if (this.fluxDirection === 'N') {
                const pos = this.GRID_SIZE - 1 - this.fluxPosition;
                if (pos >= 0) {
                    for (let x = 0; x < this.GRID_SIZE; x++) {
                        if (this.fluxSafeRows.includes(x)) continue;
                        
                        if (this.grid[pos][x] === 0) {
                            this.grid[pos][x] = 4;
                            this.updateTileVisual(x, pos);
                        }
                        if (this.playerPos.y === pos && this.playerPos.x === x) {
                            this.handleDamage();
                        }
                    }
                } else {
                    this.fluxActive = false;
                    for (let y = 0; y < this.GRID_SIZE; y++) {
                        for (let x = 0; x < this.GRID_SIZE; x++) {
                            if (this.grid[y][x] === 4) {
                                this.grid[y][x] = 0;
                                this.updateTileVisual(x, y);
                            }
                        }
                    }
                }
            }
        }
        
        // Update projectiles
        if (this.cannonActive) {
            const remaining = [];
            this.projectiles.forEach(p => {
                const nx = p.x + p.dx;
                const ny = p.y + p.dy;
                
                const dist = Phaser.Math.Distance.Between(nx, ny, this.playerPos.x, this.playerPos.y);
                if (dist < 0.6) {
                    this.handleDamage();
                    p.sprite.destroy();
                    return;
                }
                
                if (nx < -1 || nx > this.GRID_SIZE || ny < -1 || ny > this.GRID_SIZE) {
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
        
        // Update glitches
        if (this.glitchActive && Math.random() < 0.05) {
            this.expandGlitches();
        }
        
        // Spawn moving walls
        if (this.movingWallsActive && Math.random() < 0.02) {
            this.spawnMovingWall();
        }
    }
    
    shootCannon() {
        if (!this.cannonActive || this.isGameOver || this.isWon || this.showingPattern) return;
        
        this.cannonPositions.forEach(cannonPos => {
            const dx = this.playerPos.x - cannonPos.x;
            const dy = this.playerPos.y - cannonPos.y;
            const angle = Math.atan2(dy, dx);
            
            const speed = 0.4;
            const projSprite = this.add.rectangle(
                cannonPos.x * this.TILE_SIZE + this.TILE_SIZE/2,
                cannonPos.y * this.TILE_SIZE + this.TILE_SIZE/2,
                this.TILE_SIZE/3, this.TILE_SIZE/3,
                0xffffff
            );
            projSprite.setDepth(15);
            
            this.projectiles.push({
                x: cannonPos.x,
                y: cannonPos.y,
                dx: Math.cos(angle) * speed,
                dy: Math.sin(angle) * speed,
                sprite: projSprite
            });
        });
        
        this.game.events.emit('play-sound', 'shoot');
    }
    
    spawnGlitches(count) {
        for (let i = 0; i < count; i++) {
            let placed = false;
            let attempts = 0;
            while (!placed && attempts < 50) {
                const rx = Math.floor(Math.random() * this.GRID_SIZE);
                const ry = Math.floor(Math.random() * this.GRID_SIZE);
                if (this.grid[ry][rx] === 0 && !this.isFinderZone(rx, ry)) {
                    this.glitches.push({x: rx, y: ry});
                    this.grid[ry][rx] = 5; // Glitch marker
                    this.updateTileVisual(rx, ry);
                    placed = true;
                }
                attempts++;
            }
        }
    }
    
    expandGlitches() {
        const newGlitches = [];
        this.glitches.forEach(g => {
            const dirs = [[1,0], [-1,0], [0,1], [0,-1]];
            const dir = dirs[Math.floor(Math.random() * dirs.length)];
            const nx = g.x + dir[0];
            const ny = g.y + dir[1];
            
            if (nx >= 0 && nx < this.GRID_SIZE && ny >= 0 && ny < this.GRID_SIZE) {
                if (this.grid[ny][nx] === 0) {
                    newGlitches.push({x: nx, y: ny});
                    this.grid[ny][nx] = 5;
                    this.updateTileVisual(nx, ny);
                    
                    if (nx === this.playerPos.x && ny === this.playerPos.y) {
                        this.handleDamage();
                    }
                }
            }
        });
        this.glitches.push(...newGlitches);
    }
    
    spawnMovingWall() {
        let placed = false;
        let attempts = 0;
        while (!placed && attempts < 20) {
            const rx = Math.floor(Math.random() * this.GRID_SIZE);
            const ry = Math.floor(Math.random() * this.GRID_SIZE);
            if (this.grid[ry][rx] === 0 && !this.isFinderZone(rx, ry) &&
                !(rx === this.playerPos.x && ry === this.playerPos.y)) {
                this.grid[ry][rx] = 1;
                this.updateTileVisual(rx, ry);
                
                this.time.delayedCall(2000, () => {
                    if (this.grid[ry] && this.grid[ry][rx] === 1) {
                        this.grid[ry][rx] = 0;
                        this.updateTileVisual(rx, ry);
                    }
                });
                placed = true;
            }
            attempts++;
        }
    }
    
    spawnSnake() {
        let startX = 5, startY = 5;
        while (this.grid[startY][startX] !== 0 || this.isFinderZone(startX, startY)) {
            startX = Math.floor(Math.random() * this.GRID_SIZE);
            startY = Math.floor(Math.random() * this.GRID_SIZE);
        }
        
        this.snake = [
            {x: startX, y: startY},
            {x: startX, y: startY + 1},
            {x: startX, y: startY + 2}
        ];
        
        this.updateSnakeVisuals();
    }
    
    spawnSnake2() {
        let startX = 15, startY = 15;
        while (this.grid[startY][startX] !== 0 || this.isFinderZone(startX, startY)) {
            startX = Math.floor(Math.random() * this.GRID_SIZE);
            startY = Math.floor(Math.random() * this.GRID_SIZE);
        }
        
        this.snake2 = [
            {x: startX, y: startY},
            {x: startX, y: startY + 1},
            {x: startX, y: startY + 2}
        ];
        
        this.updateSnake2Visuals();
    }
    
    updateSnakeVisuals() {
        this.snakeSprites.forEach(s => s.destroy());
        this.snakeSprites = [];
        
        this.snake.forEach((seg, i) => {
            const sprite = this.add.rectangle(
                seg.x * this.TILE_SIZE + this.TILE_SIZE / 2,
                seg.y * this.TILE_SIZE + this.TILE_SIZE / 2,
                this.TILE_SIZE - 4,
                this.TILE_SIZE - 4,
                i === 0 ? 0xff0000 : 0xdc2626
            );
            sprite.setDepth(12);
            this.snakeSprites.push(sprite);
        });
    }
    
    updateSnake2Visuals() {
        this.snake2Sprites.forEach(s => s.destroy());
        this.snake2Sprites = [];
        
        this.snake2.forEach((seg, i) => {
            const sprite = this.add.rectangle(
                seg.x * this.TILE_SIZE + this.TILE_SIZE / 2,
                seg.y * this.TILE_SIZE + this.TILE_SIZE / 2,
                this.TILE_SIZE - 4,
                this.TILE_SIZE - 4,
                i === 0 ? 0xff0000 : 0xdc2626
            );
            sprite.setDepth(12);
            this.snake2Sprites.push(sprite);
        });
    }
    
    moveSnake() {
        if (!this.snakeActive || this.isGameOver || this.isWon || this.showingPattern) return;
        
        // Move snake 1
        if (this.snake.length > 0) {
            const head = this.snake[0];
            let dx = this.playerPos.x - head.x;
            let dy = this.playerPos.y - head.y;
            
            let nextX = head.x;
            let nextY = head.y;
            
            if (Math.random() < 0.6) {
                if (Math.abs(dx) > Math.abs(dy)) {
                    nextX = head.x + Math.sign(dx);
                } else if (dy !== 0) {
                    nextY = head.y + Math.sign(dy);
                } else {
                    nextX = head.x + Math.sign(dx);
                }
            } else {
                const dirs = [[1,0], [-1,0], [0,1], [0,-1]];
                const dir = dirs[Math.floor(Math.random() * dirs.length)];
                nextX = head.x + dir[0];
                nextY = head.y + dir[1];
            }
            
            if (nextX >= 0 && nextX < this.GRID_SIZE && nextY >= 0 && nextY < this.GRID_SIZE) {
                const cell = this.grid[nextY][nextX];
                if (cell !== 1) {
                    this.snake.unshift({x: nextX, y: nextY});
                    this.snake.pop();
                    
                    if (this.snake.some(seg => seg.x === this.playerPos.x && seg.y === this.playerPos.y)) {
                        this.handleDamage();
                    }
                }
            }
            
            this.updateSnakeVisuals();
        }
        
        // Move snake 2
        if (this.snake2.length > 0) {
            const head2 = this.snake2[0];
            let dx2 = this.playerPos.x - head2.x;
            let dy2 = this.playerPos.y - head2.y;
            
            let nextX2 = head2.x;
            let nextY2 = head2.y;
            
            if (Math.random() < 0.6) {
                if (Math.abs(dx2) > Math.abs(dy2)) {
                    nextX2 = head2.x + Math.sign(dx2);
                } else if (dy2 !== 0) {
                    nextY2 = head2.y + Math.sign(dy2);
                } else {
                    nextX2 = head2.x + Math.sign(dx2);
                }
            } else {
                const dirs = [[1,0], [-1,0], [0,1], [0,-1]];
                const dir = dirs[Math.floor(Math.random() * dirs.length)];
                nextX2 = head2.x + dir[0];
                nextY2 = head2.y + dir[1];
            }
            
            if (nextX2 >= 0 && nextX2 < this.GRID_SIZE && nextY2 >= 0 && nextY2 < this.GRID_SIZE) {
                const cell2 = this.grid[nextY2][nextX2];
                if (cell2 !== 1) {
                    this.snake2.unshift({x: nextX2, y: nextY2});
                    this.snake2.pop();
                    
                    if (this.snake2.some(seg => seg.x === this.playerPos.x && seg.y === this.playerPos.y)) {
                        this.handleDamage();
                    }
                }
            }
            
            this.updateSnake2Visuals();
        }
    }

    update(time, delta) {
        if (this.isGameOver || this.isWon || this.showingPattern) return;

        if (!this.isMoving) {
            if (this.cursors.left.isDown || this.wasd.left.isDown) this.handleInput(-1, 0);
            else if (this.cursors.right.isDown || this.wasd.right.isDown) this.handleInput(1, 0);
            else if (this.cursors.up.isDown || this.wasd.up.isDown) this.handleInput(0, -1);
            else if (this.cursors.down.isDown || this.wasd.down.isDown) this.handleInput(0, 1);
        }
        
        // Mantieni i simboli dritti durante la rotazione
        const camRot = this.cameras.main.rotation;
        for (let y = 0; y < this.GRID_SIZE; y++) {
            for (let x = 0; x < this.GRID_SIZE; x++) {
                if (this.tileTexts[y][x]) {
                    this.tileTexts[y][x].setRotation(-camRot);
                }
            }
        }
        
        // Player symbol rotation
        if (this.playerSymbol) {
            this.playerSymbol.setRotation(-camRot);
        }
        
        this.updateUI();
    }

    handleDamage() {
        this.game.events.emit('play-sound', 'damage');
        this.lives--;
        this.cameras.main.flash(200, 255, 0, 0);
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
        
        // ESPLOSIONE FINALE TOTALE
        this.cameras.main.flash(2000, 255, 255, 255);
        
        this.tileSprites.forEach((row, y) => {
            row.forEach((tile, x) => {
                const dx = x - 10;
                const dy = y - 10;
                const angle = Math.atan2(dy, dx);
                const dist = Math.sqrt(dx*dx + dy*dy);
                
                this.tweens.add({
                    targets: tile,
                    x: tile.x + Math.cos(angle) * 1000,
                    y: tile.y + Math.sin(angle) * 1000,
                    rotation: Math.random() * Math.PI * 8,
                    scale: 0,
                    alpha: 0,
                    duration: 2000,
                    delay: dist * 50,
                    ease: 'Power3.easeIn'
                });
            });
        });
        
        this.time.delayedCall(2000, () => {
            this.game.events.emit('play-sound', 'win');
            this.game.events.emit('game-over', { win: true, nextLevel: null });
            this.scene.pause();
        });
    }

    updateUI() {
        const progress = `${this.currentCollectIndex}/${this.TOTAL_SYMBOLS}`;
        this.game.events.emit('update-ui', {
            lives: this.lives,
            level: 10,
            timeLeft: this.showingPattern ? '⚡ MEMORIZZA ⚡' : `SIMBOLI ${progress}`
        });
    }
}