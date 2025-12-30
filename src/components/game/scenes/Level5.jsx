import Phaser from 'phaser';

export default class Level5 extends Phaser.Scene {
    constructor() {
        super({ key: 'Level5' });
    }

    create() {
        // --- Constants ---
        this.GRID_SIZE = 21;
        this.TILE_SIZE = Math.min(this.scale.width, this.scale.height) / this.GRID_SIZE;
        this.ROTATION_INTERVAL = 7000;
        this.SEQUENCE_LENGTH = 8; // 8 bit code

        // --- State ---
        this.playerPos = { x: 10, y: 10 };
        this.grid = []; 
        this.tileSprites = []; 
        this.tileTexts = []; 
        
        // Discrete movement state
        this.isMoving = false;
        
        this.lives = this.registry.get('lives') || 3;
        this.isGameOver = false;
        this.isWon = false;
        
        this.rotationTimer = 0;
        this.currentRotation = 0;

        // Binary Puzzle State
        this.targetSequence = "";
        this.currentSequence = "";
        
        this.projectiles = [];
        this.shotCount = 0;
        this.SHOOT_INTERVAL = 4500; // Slower frequency

        this.cameras.main.setBackgroundColor('#e5e5e5'); // Match other levels
        
        this.generateSequence();
        this.generateGrid();
        this.drawGrid();
        this.setupPlayer();
        this.setupInputs();
        this.updateUI();
        
        // Rotation
        this.time.addEvent({
            delay: this.ROTATION_INTERVAL,
            callback: this.rotateWorld,
            callbackScope: this,
            loop: true
        });

        // Cannons (Finder Patterns)
        this.shootCannons(); // First shot immediately
        this.time.addEvent({
            delay: this.SHOOT_INTERVAL,
            callback: this.shootCannons,
            callbackScope: this,
            loop: true
        });

        // Projectile Movement
        this.time.addEvent({
            delay: 150, // Slow projectiles
            callback: this.moveProjectiles,
            callbackScope: this,
            loop: true
        });
    }

    generateSequence() {
        this.targetSequence = "";
        for(let i=0; i<this.SEQUENCE_LENGTH; i++) {
            this.targetSequence += Math.random() > 0.5 ? "1" : "0";
        }
        this.game.events.emit('update-binary', { target: this.targetSequence, current: "" });
    }

    generateGrid() {
        this.grid = Array(this.GRID_SIZE).fill().map(() => Array(this.GRID_SIZE).fill(0));
        
        // 1. Standard QR Noise Walls (0.3 density)
        for (let y = 0; y < this.GRID_SIZE; y++) {
            for (let x = 0; x < this.GRID_SIZE; x++) {
                if (Math.random() < 0.3) this.grid[y][x] = 1;
            }
        }

        // 2. Finder Patterns (Standard QR Style)
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

        // 3. Clear Center (Start)
        this.grid[10][10] = 0;
        
        // 4. Scatter 0s (8) and 1s (9)
        // Ensure reachability? Carve paths?
        // Let's carve a random path walk first to ensure connectivity, then scatter numbers on empty spots.
        this.carvePaths();

        for(let y=0; y<this.GRID_SIZE; y++) {
            for(let x=0; x<this.GRID_SIZE; x++) {
                if(this.grid[y][x] === 0 && (x!==10 || y!==10) && !this.isFinderZone(x, y)) {
                    if (Math.random() < 0.25) { // 25% chance to be a number
                        this.grid[y][x] = Math.random() > 0.5 ? 8 : 9;
                    }
                }
            }
        }
        
        // 5. Spawn initial hearts (3 scattered around)
        let heartsPlaced = 0;
        const totalHearts = 3;
        let attempts = 0;
        while (heartsPlaced < totalHearts && attempts < 100) {
            const rx = Math.floor(Math.random() * this.GRID_SIZE);
            const ry = Math.floor(Math.random() * this.GRID_SIZE);
            if (this.grid[ry][rx] === 0 && !this.isFinderZone(rx, ry) && 
                !(rx === this.playerPos.x && ry === this.playerPos.y)) {
                this.grid[ry][rx] = 17; // Heart
                heartsPlaced++;
            }
            attempts++;
        }
    }

    carvePaths() {
        // Ensure some connectivity
        const center = {x: 10, y: 10};
        const targets = [
            {x: 2, y: 2}, {x: 18, y: 2}, {x: 2, y: 18}, {x: 18, y: 18}, // Corners
            {x: 10, y: 2}, {x: 10, y: 18}, {x: 2, y: 10}, {x: 18, y: 10} // Mids
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
                
                // Base Tile
                const rect = this.add.rectangle(cx, cy, size, size, 0xffffff);
                rowSprites.push(rect);
                
                // Text Container
                const text = this.add.text(cx, cy, '', {
                    fontFamily: 'monospace',
                    fontSize: `${size * 0.7}px`,
                    color: '#000000',
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
            rect.setFillStyle(0x000000);
            rect.setDepth(0);
        } else if (type === 3) {
            rect.setFillStyle(0x22c55e);
            rect.setDepth(20);
        } else if (type === 8) { // '0'
            rect.setFillStyle(0xffffff);
            text.setText('0');
            text.setColor('#0891b2');
            rect.setDepth(0);
        } else if (type === 9) { // '1'
            rect.setFillStyle(0xffffff);
            text.setText('1');
            text.setColor('#7c3aed');
            rect.setDepth(0);
        } else if (type === 17) { // Heart - Green with white heart symbol
            rect.setFillStyle(0x10b981);
            text.setText('♥');
            text.setColor('#ffffff');
            text.setFontSize(`${this.TILE_SIZE * 0.6}px`);
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
                if (Math.abs(dx) > Math.abs(dy)) this.handleInput(dx > 0 ? 1 : -1, 0);
                else this.handleInput(0, dy > 0 ? 1 : -1);
            }
        });
    }

    handleInput(dx, dy) {
        // Discrete input: only accept if not moving
        if (this.isMoving || this.isGameOver || this.isWon) return;

        // Update player symbol based on screen direction (before rotation transform)
        if (dx > 0) this.playerSymbol.setText('>');
        else if (dx < 0) this.playerSymbol.setText('<');
        else if (dy > 0) this.playerSymbol.setText('v');
        else if (dy < 0) this.playerSymbol.setText('^');

        const rad = -this.cameras.main.rotation;
        const gridDx = Math.round(dx * Math.cos(rad) - dy * Math.sin(rad));
        const gridDy = Math.round(dx * Math.sin(rad) + dy * Math.cos(rad));
        
        this.attemptMove(gridDx, gridDy);
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
        
        // Update Grid logic immediately
        const collected = (cell === 8 || cell === 9);
        const collectedVal = cell === 8 ? "0" : "1";
        
        if (collected) {
             this.handleBinaryCollect(nextX, nextY, collectedVal);
        } else if (cell === 17) {
            // Heart
            this.handleHeal(nextX, nextY);
        }

        this.playerPos = { x: nextX, y: nextY };
        
        // Animate visual movement
        this.tweens.add({
            targets: [this.player, this.playerSymbol],
            x: nextX * this.TILE_SIZE + this.TILE_SIZE / 2,
            y: nextY * this.TILE_SIZE + this.TILE_SIZE / 2,
            duration: 150, // Fast snap
            ease: 'Power2',
            onComplete: () => {
                this.isMoving = false;
            }
        });
    }

    update(time, delta) {
        if (this.isGameOver || this.isWon) return;

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
        
        // Update player symbol rotation
        if (this.playerSymbol) {
            this.playerSymbol.setRotation(-camRot);
        }
    }

    rotateWorld() {
        this.currentRotation += 90;
        this.tweens.add({
            targets: this.cameras.main,
            rotation: Phaser.Math.DegToRad(this.currentRotation),
            duration: 1000,
            ease: 'Cubic.easeOut'
        });
        
        this.flipBinaryValues();
    }

    flipBinaryValues() {
        for(let y=0; y<this.GRID_SIZE; y++) {
            for(let x=0; x<this.GRID_SIZE; x++) {
                if (this.grid[y][x] === 8) {
                    this.grid[y][x] = 9; // 0 -> 1
                    this.updateTileVisual(x, y);
                } else if (this.grid[y][x] === 9) {
                    this.grid[y][x] = 8; // 1 -> 0
                    this.updateTileVisual(x, y);
                }
            }
        }
    }

    shootCannons() {
        if (this.isGameOver || this.isWon) return;

        const cannons = [
            {x: 3, y: 3},
            {x: 17, y: 3},
            {x: 3, y: 17}
        ];

        cannons.forEach(cannon => {
            let dirX = 0, dirY = 0;

            if (this.shotCount === 0) {
                // First shot: Safe demonstration (Cardinal direction towards center)
                let dx = 10 - cannon.x;
                let dy = 10 - cannon.y;
                if (Math.abs(dx) > Math.abs(dy)) dirX = Math.sign(dx);
                else dirY = Math.sign(dy);
            } else {
                // Precision Aiming (Float vectors)
                const dx = this.playerPos.x - cannon.x;
                const dy = this.playerPos.y - cannon.y;
                const angle = Math.atan2(dy, dx);
                
                // Slower speed for fairness
                const speed = 0.5; 
                dirX = Math.cos(angle) * speed;
                dirY = Math.sin(angle) * speed;
            }
            
            const projSprite = this.add.rectangle(
                cannon.x * this.TILE_SIZE + this.TILE_SIZE/2,
                cannon.y * this.TILE_SIZE + this.TILE_SIZE/2,
                this.TILE_SIZE/3, this.TILE_SIZE/3, 
                0x000000 
            );
            projSprite.setStrokeStyle(2, 0xff0000);
            projSprite.setDepth(15);

            this.projectiles.push({
                x: cannon.x,
                y: cannon.y,
                dx: dirX,
                dy: dirY,
                sprite: projSprite
            });
        });

        this.game.events.emit('play-sound', 'shoot');
        this.shotCount++;
    }

    moveProjectiles() {
        const remaining = [];
        this.projectiles.forEach(p => {
            const nx = p.x + p.dx;
            const ny = p.y + p.dy;
            
            // Hit Player? (Distance check for float positions)
            const dist = Phaser.Math.Distance.Between(nx, ny, this.playerPos.x, this.playerPos.y);
            if (dist < 0.6) {
                this.handleDamage();
                p.sprite.destroy();
                return;
            }

            // Out of bounds?
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

    handleBinaryCollect(x, y, value) {
        const needed = this.targetSequence[this.currentSequence.length];
        
        if (value === needed) {
            // Correct
            this.currentSequence += value;
            this.game.events.emit('play-sound', 'collect');
            this.game.events.emit('update-binary', { target: this.targetSequence, current: this.currentSequence });
            
            this.grid[y][x] = 0;
            this.updateTileVisual(x, y);
            
            if (this.currentSequence === this.targetSequence) {
                this.handleWin();
            }
        } else {
            // Wrong
            this.handleDamage();
            // User: "se sceglie un 1 e doveva scegliere uno 0 si perde una vita"
            // Item stays? Or removed? Let's keep it.
        }
    }

    handleHeal(x, y) {
        this.game.events.emit('play-sound', 'heal');
        this.lives++;
        this.grid[y][x] = 0;
        this.updateTileVisual(x, y);
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
        this.game.events.emit('game-over', { win: true, nextLevel: 6 });
        this.scene.pause();
    }

    updateUI(timeLeft = 7) {
        this.game.events.emit('update-ui', {
            lives: this.lives,
            level: 5,
            timeLeft: timeLeft
        });
    }
}