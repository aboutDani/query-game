import Phaser from 'phaser';

export default class Level8 extends Phaser.Scene {
    constructor() {
        super({ key: 'Level8' });
    }

    create() {
        // --- Constants ---
        this.GRID_SIZE = 21;
        this.TILE_SIZE = Math.min(this.scale.width, this.scale.height) / this.GRID_SIZE;
        this.ROTATION_INTERVAL = 7000;
        this.PATTERN_LENGTH = 5; // Memory sequence length

        // --- State ---
        this.playerPos = { x: 10, y: 10 };
        this.grid = []; 
        this.tileSprites = []; 
        this.tileTexts = [];
        
        // Discrete movement state
        this.isMoving = false;
        this.inputProcessed = false; // Prevent multiple inputs from same key press

        this.lives = this.registry.get('lives') || 3;
        this.isGameOver = false;
        this.isWon = false;
        
        this.rotationTimer = 0;
        this.currentRotation = 0;

        // Memory Game State
        this.targetPattern = []; // Sequence of directions: N, S, E, W
        this.currentPatternIndex = 0;
        this.isShowingPattern = true;
        this.patternTiles = [];
        
        this.cameras.main.setBackgroundColor('#1a1a1a'); 
        
        this.generatePattern();
        this.generateGrid();
        this.drawGrid();
        this.setupPlayer();
        this.setupInputs();
        this.updateUI();
        
        // Show pattern initially
        this.showPattern();
        
        // Rotation
        this.time.addEvent({
            delay: this.ROTATION_INTERVAL,
            callback: this.rotateWorld,
            callbackScope: this,
            loop: true
        });
    }

    generatePattern() {
        const directions = ['N', 'S', 'E', 'W'];
        this.targetPattern = [];
        for (let i = 0; i < this.PATTERN_LENGTH; i++) {
            this.targetPattern.push(directions[Math.floor(Math.random() * directions.length)]);
        }
        this.game.events.emit('update-pattern', { 
            pattern: this.targetPattern, 
            current: 0 
        });
    }

    generateGrid() {
        this.grid = Array(this.GRID_SIZE).fill().map(() => Array(this.GRID_SIZE).fill(0));
        
        // Simple noise walls
        for (let y = 0; y < this.GRID_SIZE; y++) {
            for (let x = 0; x < this.GRID_SIZE; x++) {
                if (Math.random() < 0.15) this.grid[y][x] = 1;
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

        // Clear Center (Start)
        this.grid[10][10] = 0;
        
        // Carve paths
        this.carvePaths();
    }

    carvePaths() {
        const center = {x: 10, y: 10};
        const targets = [
            {x: 2, y: 2}, {x: 18, y: 2}, {x: 2, y: 18}, {x: 18, y: 18},
            {x: 10, y: 2}, {x: 10, y: 18}, {x: 2, y: 10}, {x: 18, y: 10}
        ];
        
        targets.forEach(t => {
            let cx = center.x, cy = center.y;
            let safety = 0;
            while((cx !== t.x || cy !== t.y) && safety < 500) {
                const dx = t.x - cx;
                const dy = t.y - cy;
                if (Math.random() < 0.7) {
                    if (Math.abs(dx) > Math.abs(dy)) cx += Math.sign(dx);
                    else cy += Math.sign(dy);
                } else {
                    if (Math.random() < 0.5) cx += (Math.random()>0.5?1:-1);
                    else cy += (Math.random()>0.5?1:-1);
                }
                cx = Math.max(0, Math.min(this.GRID_SIZE-1, cx));
                cy = Math.max(0, Math.min(this.GRID_SIZE-1, cy));
                
                if (this.grid[cy][cx] === 1 && !this.isFinderZone(cx, cy)) this.grid[cy][cx] = 0;
                safety++;
            }
        });
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
                    fontFamily: 'Arial, sans-serif',
                    fontSize: `${size * 0.7}px`,
                    color: '#ffffff',
                    fontStyle: '900',
                    align: 'center',
                    stroke: '#000000',
                    strokeThickness: 2
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
            rect.setFillStyle(0x000000);
            rect.setDepth(0);
        } else if (type === 3) {
            rect.setFillStyle(0x22c55e);
            rect.setDepth(20);
        } else {
            rect.setFillStyle(0x2a2a2a);
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
                if (Math.abs(dx) > Math.abs(dy)) this.handleInput(dx > 0 ? 1 : -1, 0);
                else this.handleInput(0, dy > 0 ? 1 : -1);
            }
        });
    }

    handleInput(dx, dy) {
        if (this.isMoving || this.isGameOver || this.isWon || this.isShowingPattern || this.inputProcessed) return;

        this.inputProcessed = true;

        // Screen direction (not grid direction) - user swipes based on what they SEE
        let direction = '';
        if (dy < 0) direction = 'N'; // Swipe UP on screen
        else if (dy > 0) direction = 'S'; // Swipe DOWN on screen
        else if (dx > 0) direction = 'E'; // Swipe RIGHT on screen
        else if (dx < 0) direction = 'W'; // Swipe LEFT on screen
        
        if (direction && direction === this.targetPattern[this.currentPatternIndex]) {
            // Correct move - now do the actual grid movement with rotation
            this.game.events.emit('play-sound', 'collect');
            this.currentPatternIndex++;
            
            // Convert to grid direction for actual movement
            const rad = -this.cameras.main.rotation;
            const gridDx = Math.round(dx * Math.cos(rad) - dy * Math.sin(rad));
            const gridDy = Math.round(dx * Math.sin(rad) + dy * Math.cos(rad));
            this.attemptMove(gridDx, gridDy);
            
            this.game.events.emit('update-pattern', { 
                pattern: this.targetPattern, 
                current: this.currentPatternIndex 
            });
            
            if (this.currentPatternIndex >= this.PATTERN_LENGTH) {
                // Pattern completed!
                this.handleWin();
            }
        } else if (direction) {
            // Wrong move
            this.handleDamage();
        }
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
        this.playerPos = { x: nextX, y: nextY };
        
        // Update player symbol based on direction
        if (dx > 0) this.playerSymbol.setText('>');
        else if (dx < 0) this.playerSymbol.setText('<');
        else if (dy > 0) this.playerSymbol.setText('v');
        else if (dy < 0) this.playerSymbol.setText('^');
        
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

    showPattern() {
        this.isShowingPattern = true;
        this.patternTiles = [];
        
        // Show each direction as an arrow tile
        const dirMap = { N: '↑', S: '↓', E: '→', W: '←' };
        const colorMap = { N: 0x3b82f6, S: 0xef4444, E: 0xf59e0b, W: 0x10b981 };
        
        this.targetPattern.forEach((dir, i) => {
            this.time.delayedCall(1000 + i * 800, () => {
                // Flash a tile with the direction
                const positions = [];
                for (let y = 0; y < this.GRID_SIZE; y++) {
                    for (let x = 0; x < this.GRID_SIZE; x++) {
                        if (this.grid[y][x] === 0 && !this.isFinderZone(x, y)) {
                            positions.push({x, y});
                        }
                    }
                }
                
                if (positions.length > 0) {
                    const pos = positions[Math.floor(Math.random() * positions.length)];
                    const sprite = this.tileSprites[pos.y][pos.x];
                    const text = this.tileTexts[pos.y][pos.x];

                    sprite.setFillStyle(colorMap[dir]);
                    text.setText(dirMap[dir]);
                    text.setColor('#ffffff');
                    text.setFontSize(`${this.TILE_SIZE * 0.9}px`);

                    this.tweens.add({
                        targets: [sprite, text],
                        scale: 1.3,
                        yoyo: true,
                        duration: 400
                    });
                    
                    this.time.delayedCall(700, () => {
                        sprite.setFillStyle(0x2a2a2a);
                        text.setText('');
                        text.setFontSize(`${this.TILE_SIZE * 0.7}px`);
                    });
                }
                
                if (i === this.targetPattern.length - 1) {
                    this.time.delayedCall(1500, () => {
                        this.isShowingPattern = false;
                    });
                }
            });
        });
    }

    update(time, delta) {
        if (this.isGameOver || this.isWon || this.isShowingPattern) return;

        // Reset input flag when no keys are pressed
        if (!this.cursors.left.isDown && !this.cursors.right.isDown && 
            !this.cursors.up.isDown && !this.cursors.down.isDown &&
            !this.wasd.left.isDown && !this.wasd.right.isDown && 
            !this.wasd.up.isDown && !this.wasd.down.isDown) {
            this.inputProcessed = false;
        }

        // Keyboard inputs (only if not moving)
        if (!this.isMoving) {
            if (this.cursors.left.isDown || this.wasd.left.isDown) this.handleInput(-1, 0);
            else if (this.cursors.right.isDown || this.wasd.right.isDown) this.handleInput(1, 0);
            else if (this.cursors.up.isDown || this.wasd.up.isDown) this.handleInput(0, -1);
            else if (this.cursors.down.isDown || this.wasd.down.isDown) this.handleInput(0, 1);
        }

        // Timer
        if (!this.nextRotationTime) this.nextRotationTime = time + this.ROTATION_INTERVAL;
        const timeLeft = Math.max(0, Math.ceil((this.nextRotationTime - time) / 1000));
        this.updateUI(timeLeft);
        
        // Sync text rotation to camera
        const camRot = this.cameras.main.rotation;
        for (let y = 0; y < this.GRID_SIZE; y++) {
            for (let x = 0; x < this.GRID_SIZE; x++) {
                if (this.tileTexts[y][x]) {
                    this.tileTexts[y][x].setRotation(-camRot);
                }
            }
        }
    }

    rotateWorld() {
        if (this.isShowingPattern) return;
        
        this.currentRotation += 90;
        this.tweens.add({
            targets: this.cameras.main,
            rotation: Phaser.Math.DegToRad(this.currentRotation),
            duration: 1000,
            ease: 'Cubic.easeOut'
        });
    }

    handleDamage() {
        this.game.events.emit('play-sound', 'damage');
        this.lives--;
        this.cameras.main.flash(200, 255, 0, 0); 
        this.cameras.main.shake(200, 0.01);
        
        // Reset pattern
        this.currentPatternIndex = 0;
        this.game.events.emit('update-pattern', { 
            pattern: this.targetPattern, 
            current: 0 
        });
        
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
        this.game.events.emit('game-over', { win: true, nextLevel: 9 });
        this.scene.pause();
    }

    updateUI(timeLeft = 7) {
        this.game.events.emit('update-ui', {
            lives: this.lives,
            level: 8,
            timeLeft: timeLeft
        });
    }
}