import Phaser from 'phaser';

export default class Level9 extends Phaser.Scene {
    constructor() {
        super({ key: 'Level9' });
    }

    create() {
        // --- Constants ---
        this.GRID_SIZE = 21;
        this.TILE_SIZE = Math.min(this.scale.width, this.scale.height) / this.GRID_SIZE;
        this.DISPLAY_TIME = 7000; // 7 seconds to memorize
        this.TOTAL_SYMBOLS = 5;

        // --- State ---
        this.playerPos = { x: 10, y: 10 };
        this.grid = []; 
        this.tileSprites = []; 
        this.tileTexts = [];
        
        this.isMoving = false;
        this.lives = this.registry.get('lives') || 3;
        this.isGameOver = false;
        this.isWon = false;
        
        this.showingPattern = true;
        this.symbolSequence = []; // Array of symbols to collect
        this.symbolPositions = []; // {symbol, x, y}
        this.currentCollectIndex = 0;
        
        // Cannons (positioned in finder patterns)
        this.cannonPositions = [
            {x: 3, y: 3},    // Top-left finder
            {x: 17, y: 3},   // Top-right finder
            {x: 3, y: 17}    // Bottom-left finder
        ];
        this.projectiles = [];
        this.cannonSprites = [];
        
        this.cameras.main.setBackgroundColor('#0a0a0a');
        
        this.generateSymbolSequence();
        this.generateGrid();
        this.drawGrid();
        this.setupPlayer();
        this.setupCannons();
        this.setupInputs();
        this.showPatternDisplay();
        this.updateUI();
        
        // Hide pattern after 7 seconds
        this.time.delayedCall(this.DISPLAY_TIME, () => {
            this.hidePatternDisplay();
            this.placeSymbolsOnGrid();
        });
        
        // Cannon firing timer (meno intenso)
        this.time.addEvent({
            delay: 2500, // Fire every 2.5 seconds
            callback: this.shootCannon,
            callbackScope: this,
            loop: true
        });
        
        // Projectile movement timer
        this.time.addEvent({
            delay: 300, // Slow projectiles
            callback: this.updateProjectiles,
            callbackScope: this,
            loop: true
        });
    }
    
    shootCannon() {
        if (this.isGameOver || this.isWon || this.showingPattern) return;
        
        this.cannonPositions.forEach(cannonPos => {
            const dx = this.playerPos.x - cannonPos.x;
            const dy = this.playerPos.y - cannonPos.y;
            const angle = Math.atan2(dy, dx);
            
            const speed = 0.3; // Slow speed
            const projSprite = this.add.circle(
                cannonPos.x * this.TILE_SIZE + this.TILE_SIZE/2,
                cannonPos.y * this.TILE_SIZE + this.TILE_SIZE/2,
                this.TILE_SIZE/6,
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
    
    updateProjectiles() {
        if (this.isGameOver || this.isWon || this.showingPattern) return;
        
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
    
    generateSymbolSequence() {
        // Always use these 5 symbols in random order
        const symbols = ['♥', '★', '■', '◆', '●'];
        this.symbolSequence = [...symbols].sort(() => Math.random() - 0.5);
    }
    
    showPatternDisplay() {
        const startY = 50;
        const centerX = this.scale.width / 2;
        
        // Row 1: Symbols
        const row1Text = this.symbolSequence.join('  ');
        this.patternRow1 = this.add.text(centerX, startY, row1Text, {
            fontFamily: 'monospace',
            fontSize: '40px',
            color: '#06b6d4',
            fontStyle: 'bold',
            align: 'center'
        }).setOrigin(0.5).setDepth(100);
        
        // Row 2: Numbers 0-4 (aligned with symbols)
        const row2Text = '0  1  2  3  4';
        this.patternRow2 = this.add.text(centerX, startY + 50, row2Text, {
            fontFamily: 'monospace',
            fontSize: '32px',
            color: '#ffffff',
            fontStyle: 'bold',
            align: 'center'
        }).setOrigin(0.5).setDepth(100);
        
        // Countdown timer
        this.countdownText = this.add.text(centerX, startY + 100, '7', {
            fontFamily: 'monospace',
            fontSize: '48px',
            color: '#ff0000',
            fontStyle: 'bold',
            align: 'center'
        }).setOrigin(0.5).setDepth(100);
        
        // Update countdown every second
        let timeLeft = 7;
        this.countdownTimer = this.time.addEvent({
            delay: 1000,
            callback: () => {
                timeLeft--;
                if (this.countdownText) {
                    this.countdownText.setText(timeLeft.toString());
                }
            },
            repeat: 6
        });
    }
    
    hidePatternDisplay() {
        this.showingPattern = false;
        if (this.patternRow1) this.patternRow1.destroy();
        if (this.patternRow2) this.patternRow2.destroy();
        if (this.countdownText) this.countdownText.destroy();
        
        // Mostra i cannoni
        this.cannonSprites.forEach(cannon => cannon.setVisible(true));
    }
    
    generateGrid() {
        this.grid = Array(this.GRID_SIZE).fill().map(() => Array(this.GRID_SIZE).fill(0));
        
        // Minimal walls
        for (let y = 0; y < this.GRID_SIZE; y++) {
            for (let x = 0; x < this.GRID_SIZE; x++) {
                if (Math.random() < 0.1) this.grid[y][x] = 1;
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

        this.grid[10][10] = 0;
    }
    
    placeSymbolsOnGrid() {
        // Place symbols randomly on the grid
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
                    
                    this.grid[ry][rx] = 20 + i; // 20-24 for symbols
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
            rect.setFillStyle(0x4a4a4a);
            rect.setDepth(0);
        } else if (type >= 20 && type <= 24) { // Symbols
            const symbolIndex = type - 20;
            const symbol = this.symbolSequence[symbolIndex];
            rect.setFillStyle(0x1a1a1a);
            text.setText(symbol);
            text.setColor('#06b6d4');
            text.setFontSize(`${this.TILE_SIZE * 0.7}px`);
            rect.setDepth(0);
        } else {
            rect.setFillStyle(0x1a1a1a);
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
    
    setupCannons() {
        this.cannonSprites = [];
        
        this.cannonPositions.forEach(pos => {
            // Cannone fatto di 2 quadrati bianchi in verticale
            const cannon1 = this.add.rectangle(
                pos.x * this.TILE_SIZE + this.TILE_SIZE / 2,
                (pos.y - 0.5) * this.TILE_SIZE + this.TILE_SIZE / 2,
                this.TILE_SIZE - 4,
                this.TILE_SIZE - 4,
                0xffffff
            );
            cannon1.setDepth(8);
            cannon1.setVisible(false); // Nascosto durante countdown
            
            const cannon2 = this.add.rectangle(
                pos.x * this.TILE_SIZE + this.TILE_SIZE / 2,
                (pos.y + 0.5) * this.TILE_SIZE + this.TILE_SIZE / 2,
                this.TILE_SIZE - 4,
                this.TILE_SIZE - 4,
                0xffffff
            );
            cannon2.setDepth(8);
            cannon2.setVisible(false); // Nascosto durante countdown
            
            this.cannonSprites.push(cannon1, cannon2);
        });
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

        if (dx > 0) this.playerSymbol.setText('>');
        else if (dx < 0) this.playerSymbol.setText('<');
        else if (dy > 0) this.playerSymbol.setText('v');
        else if (dy < 0) this.playerSymbol.setText('^');
        
        this.attemptMove(dx, dy);
    }
    
    attemptMove(dx, dy) {
        let nextX = this.playerPos.x + dx;
        let nextY = this.playerPos.y + dy;

        // Wrap Logic
        if (nextX < 0) nextX = this.GRID_SIZE - 1;
        if (nextX >= this.GRID_SIZE) nextX = 0;
        if (nextY < 0) nextY = this.GRID_SIZE - 1;
        if (nextY >= this.GRID_SIZE) nextY = 0;

        const cell = this.grid[nextY][nextX];
        
        // Wall check
        if (cell === 1) return; 

        // Start Move
        this.isMoving = true;
        
        // Check for symbol collection
        if (cell >= 20 && cell <= 24) {
            const symbolIndex = cell - 20;
            
            if (symbolIndex === this.currentCollectIndex) {
                // Correct symbol!
                this.game.events.emit('play-sound', 'collect');
                this.currentCollectIndex++;
                this.grid[nextY][nextX] = 0;
                this.updateTileVisual(nextX, nextY);
                
                if (this.currentCollectIndex >= this.TOTAL_SYMBOLS) {
                    this.handleWin();
                    return;
                }
            } else {
                // Wrong symbol - lose life but continue playing
                this.handleDamage();
            }
        }

        this.playerPos = { x: nextX, y: nextY };
        
        // Animate visual movement
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

    update(time, delta) {
        if (this.isGameOver || this.isWon || this.showingPattern) return;

        // Keyboard inputs
        if (!this.isMoving) {
            if (this.cursors.left.isDown || this.wasd.left.isDown) this.handleInput(-1, 0);
            else if (this.cursors.right.isDown || this.wasd.right.isDown) this.handleInput(1, 0);
            else if (this.cursors.up.isDown || this.wasd.up.isDown) this.handleInput(0, -1);
            else if (this.cursors.down.isDown || this.wasd.down.isDown) this.handleInput(0, 1);
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
        this.cameras.main.flash(500, 0, 255, 100);
        this.game.events.emit('play-sound', 'win');
        this.game.events.emit('game-over', { win: true, nextLevel: null });
        this.scene.pause();
    }

    updateUI() {
        const progress = `${this.currentCollectIndex}/${this.TOTAL_SYMBOLS}`;
        this.game.events.emit('update-ui', {
            lives: this.lives,
            level: 9,
            timeLeft: this.showingPattern ? 'MEMORIZZA' : progress
        });
    }
}