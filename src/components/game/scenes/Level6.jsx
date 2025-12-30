import Phaser from 'phaser';

export default class Level6 extends Phaser.Scene {
    constructor() {
        super({ key: 'Level6' });
    }

    create() {
        // --- Constants ---
        this.GRID_SIZE = 21;
        this.TILE_SIZE = Math.min(this.scale.width, this.scale.height) / this.GRID_SIZE;
        this.MOVE_SPEED = this.registry.get('moveSpeed') || 220; 
        this.ROTATION_INTERVAL = 6000;
        
        // --- State ---
        this.playerPos = { x: 10, y: 18 }; 
        this.grid = []; 
        this.tileSprites = []; 
        this.projectiles = []; 
        this.keysCollected = 0;
        this.TOTAL_KEYS = 5;
        this.isGameOver = false;
        this.isWon = false;
        
        this.nextDirection = { x: 0, y: 0 };
        this.currentDirection = { x: 0, y: 0 };
        this.lastMoveTime = 0;
        
        this.lives = this.registry.get('lives') || 3;
        this.currentRotation = 0;
        
        this.cameras.main.setBackgroundColor('#000000'); 
        
        this.generateGrid();
        this.drawGrid();
        this.setupPlayer();
        this.setupInputs();
        this.updateUI();

        // The Source "Eye" Pulse
        this.time.addEvent({
            delay: 2000,
            callback: this.pulseSource,
            callbackScope: this,
            loop: true
        });

        // Spiral Attack
        this.time.addEvent({
            delay: 4000,
            callback: this.spiralAttack,
            callbackScope: this,
            loop: true
        });
        
        // Dynamic Wall Spawning (The Architect blocks you)
        this.time.addEvent({
            delay: 3000,
            callback: this.spawnRandomWall,
            callbackScope: this,
            loop: true
        });

        // Projectile Move
        this.time.addEvent({
            delay: 100, // Very smooth/fast
            callback: this.moveProjectiles,
            callbackScope: this,
            loop: true
        });
        
        // Rotation
        this.time.addEvent({
            delay: this.ROTATION_INTERVAL,
            callback: this.rotateWorld,
            callbackScope: this,
            loop: true
        });
    }

    generateGrid() {
        this.grid = Array(this.GRID_SIZE).fill().map(() => Array(this.GRID_SIZE).fill(0));
        
        // 1. The Source (Center)
        const center = 10;
        for(let y=center-2; y<=center+2; y++) {
            for(let x=center-2; x<=center+2; x++) {
                this.grid[y][x] = 9; // 9 = THE SOURCE
            }
        }
        
        // 2. Initial Rings
        for(let r=4; r<10; r+=2) {
            for(let i=center-r; i<=center+r; i++) {
                if(i>=0 && i<this.GRID_SIZE) {
                    // Sparse walls
                    if(Math.random()<0.1) this.grid[center-r][i] = 1;
                    if(Math.random()<0.1) this.grid[center+r][i] = 1;
                    if(Math.random()<0.1) this.grid[i][center-r] = 1;
                    if(Math.random()<0.1) this.grid[i][center+r] = 1;
                }
            }
        }

        // 3. Place 5 Fragments
        let fragments = 0;
        while(fragments < this.TOTAL_KEYS) {
            const rx = Math.floor(Math.random()*this.GRID_SIZE);
            const ry = Math.floor(Math.random()*this.GRID_SIZE);
            const dist = Math.abs(rx-10) + Math.abs(ry-10);
            if(this.grid[ry][rx] === 0 && dist > 4 && dist < 9) {
                this.grid[ry][rx] = 7; // Fragment
                fragments++;
            }
        }
        
        // 4. Place 1 Heart
        let hearts = 0;
        while(hearts < 1) {
            const rx = Math.floor(Math.random()*this.GRID_SIZE);
            const ry = Math.floor(Math.random()*this.GRID_SIZE);
            const dist = Math.abs(rx-10) + Math.abs(ry-10);
            if(this.grid[ry][rx] === 0 && dist > 4 && dist < 9) {
                this.grid[ry][rx] = 17; // Heart
                hearts++;
            }
        }
        
        // Start Pos
        this.grid[18][10] = 0;
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

    updateTileVisual(x, y) {
        if (x < 0 || x >= this.GRID_SIZE || y < 0 || y >= this.GRID_SIZE) return;
        this.updateTileVisualByObj(this.tileSprites[y][x], this.tileTexts[y][x], this.grid[y][x]);
    }

    updateTileVisualByObj(rect, text, type) {
        if (text) text.setText('');
        
        if (type === 1) rect.setFillStyle(0x333333); // Wall
        else if (type === 3) rect.setFillStyle(0x22c55e); // Final Exit
        else if (type === 9) rect.setFillStyle(0xffffff); // The Source (White/Blinding)
        else if (type === 7) rect.setFillStyle(0xa855f7); // Fragment (Purple)
        else if (type === 17) { // Heart - Green with white heart symbol
            rect.setFillStyle(0x10b981);
            if (text) {
                text.setText('♥');
                text.setColor('#ffffff');
                text.setFontSize(`${this.TILE_SIZE * 0.6}px`);
            }
        }
        else rect.setFillStyle(0x000000); // Void Floor
        
        if (type === 9) {
            // Pulse animation handled in pulseSource
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
        this.input.on('pointerdown', (p) => { this.touchStartX = p.x; this.touchStartY = p.y; });
        this.input.on('pointerup', (p) => {
            const dx = p.x - this.touchStartX;
            const dy = p.y - this.touchStartY;
            if (Math.abs(dx) > 20 || Math.abs(dy) > 20) {
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

    setDirection(dx, dy) { this.nextDirection = { x: dx, y: dy }; }

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
        const timeLeft = Math.max(0, Math.ceil((this.nextRotationTime - time) / 1000));
        this.updateUI(timeLeft);
    }

    spawnRandomWall() {
        // The Architect spawns a wall near the player
        let placed = false;
        let attempts = 0;
        while(!placed && attempts < 10) {
            const range = 3;
            const ox = Math.floor(Math.random() * (range*2+1)) - range;
            const oy = Math.floor(Math.random() * (range*2+1)) - range;
            const tx = Math.max(0, Math.min(this.GRID_SIZE-1, this.playerPos.x + ox));
            const ty = Math.max(0, Math.min(this.GRID_SIZE-1, this.playerPos.y + oy));
            
            if (this.grid[ty][tx] === 0 && (tx!==this.playerPos.x || ty!==this.playerPos.y)) {
                this.grid[ty][tx] = 1;
                this.updateTileVisual(tx, ty);
                // Flash the tile
                const sprite = this.tileSprites[ty][tx];
                this.tweens.add({ targets: sprite, alpha: {from: 0, to: 1}, duration: 500 });
                placed = true;
            }
            attempts++;
        }
    }

    spiralAttack() {
        // Shoot in a spiral pattern from center
        const center = 10;
        const arms = 8;
        for(let i=0; i<arms; i++) {
            const angle = (this.time.now / 1000) + (i * (Math.PI * 2 / arms));
            const dx = Math.cos(angle);
            const dy = Math.sin(angle);
            
            const projSprite = this.add.circle(
                center * this.TILE_SIZE + this.TILE_SIZE/2,
                center * this.TILE_SIZE + this.TILE_SIZE/2,
                this.TILE_SIZE/4, 
                0xffffff
            );
            projSprite.setDepth(15);

            this.projectiles.push({
                x: center,
                y: center,
                dx: dx * 0.5, // Slow expanding wave
                dy: dy * 0.5,
                sprite: projSprite
            });
        }
        this.game.events.emit('play-sound', 'shoot');
    }

    pulseSource() {
        // Visual pulse of the center 5x5 area
        const center = 10;
        for(let y=center-2; y<=center+2; y++) {
            for(let x=center-2; x<=center+2; x++) {
                const sprite = this.tileSprites[y][x];
                this.tweens.add({
                    targets: sprite,
                    scale: 0.8,
                    yoyo: true,
                    duration: 200
                });
            }
        }
    }

    moveProjectiles() {
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

            if (nx < -2 || nx > this.GRID_SIZE+2 || ny < -2 || ny > this.GRID_SIZE+2) {
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

        if (nextX < 0) nextX = this.GRID_SIZE - 1;
        if (nextX >= this.GRID_SIZE) nextX = 0;
        if (nextY < 0) nextY = this.GRID_SIZE - 1;
        if (nextY >= this.GRID_SIZE) nextY = 0;

        const cell = this.grid[nextY][nextX];
        if (cell !== 1 && cell !== 9) { // Wall or Source Body
            this.playerPos = { x: nextX, y: nextY };
            
            // Update player symbol based on direction
            if (this.currentDirection.x > 0) this.playerSymbol.setText('>');
            else if (this.currentDirection.x < 0) this.playerSymbol.setText('<');
            else if (this.currentDirection.y > 0) this.playerSymbol.setText('v');
            else if (this.currentDirection.y < 0) this.playerSymbol.setText('^');
            
            if (cell === 3) this.handleWin();
            else if (cell === 7) this.handleFragmentCollect(nextX, nextY);
            else if (cell === 17) this.handleHeal(nextX, nextY);
            
            this.updatePlayerVisuals();
        } else if (cell === 9) {
            // Can only enter source if unlocked
            if (this.keysCollected >= this.TOTAL_KEYS) {
                this.playerPos = { x: nextX, y: nextY };
                this.handleWin();
            } else {
                this.handleDamage(); // Source burns
            }
        }
    }

    updatePlayerVisuals() {
        this.player.x = this.playerPos.x * this.TILE_SIZE + this.TILE_SIZE / 2;
        this.player.y = this.playerPos.y * this.TILE_SIZE + this.TILE_SIZE / 2;
        this.playerSymbol.x = this.playerPos.x * this.TILE_SIZE + this.TILE_SIZE / 2;
        this.playerSymbol.y = this.playerPos.y * this.TILE_SIZE + this.TILE_SIZE / 2;
    }

    handleFragmentCollect(x, y) {
        this.game.events.emit('play-sound', 'collect');
        this.keysCollected++;
        this.grid[y][x] = 0;
        this.updateTileVisual(x, y);
        
        if (this.keysCollected >= this.TOTAL_KEYS) {
            // Open the Source - clear all and place exit
            const center = 10;
            
            // Clear ENTIRE 5x5 Source area
            for(let ty=center-2; ty<=center+2; ty++) {
                for(let tx=center-2; tx<=center+2; tx++) {
                    this.grid[ty][tx] = 3; // Make entire area the exit
                    this.updateTileVisual(tx, ty);
                }
            }
            
            this.cameras.main.flash(500, 255, 255, 255);
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
        this.game.events.emit('game-over', { win: true, nextLevel: 7 });
        this.scene.pause();
    }

    updateUI(timeLeft = 6) {
        this.game.events.emit('update-ui', {
            lives: this.lives,
            level: 6,
            timeLeft: timeLeft
        });
    }
}