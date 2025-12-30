import Phaser from 'phaser';

export default class Level7 extends Phaser.Scene {
    constructor() {
        super({ key: 'Level7' });
    }

    create() {
        // --- Constants ---
        this.GRID_SIZE = 21;
        this.TILE_SIZE = Math.min(this.scale.width, this.scale.height) / this.GRID_SIZE;
        this.ROTATION_INTERVAL = 15000;

        // --- State ---
        this.playerPos = { x: 10, y: 10 };
        this.grid = []; // 0: empty, 1: wall, 2-10: numbers 1-9, 12-16: negative numbers -1 to -5, 17: heart
        this.tileSprites = []; 
        this.tileTexts = [];
        
        this.isMoving = false;
        this.inputProcessed = false;
        
        this.lives = this.registry.get('lives') || 3;
        this.isGameOver = false;
        this.isWon = false;
        
        this.currentRotation = 0;
        this.currentSum = 0;
        this.targetNumber = 0;
        
        // Snake state
        this.snake = []; // Array of {x, y} positions, [0] is head
        this.snakeSprites = [];

        this.cameras.main.setBackgroundColor('#0a0a0a');
        
        this.generateGrid();
        this.generateTarget();
        this.drawGrid();
        this.setupPlayer();
        this.setupSnake();
        this.setupInputs();
        this.updateUI();
        
        // Rotation timer
        this.time.addEvent({
            delay: this.ROTATION_INTERVAL,
            callback: this.rotateWorld,
            callbackScope: this,
            loop: true
        });
        
        // Snake movement timer (slower than player)
        this.time.addEvent({
            delay: 500,
            callback: this.moveSnake,
            callbackScope: this,
            loop: true
        });
    }
    
    setupSnake() {
        // Start with 3 segments
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
    
    updateSnakeVisuals() {
        // Destroy old sprites
        this.snakeSprites.forEach(s => s.destroy());
        this.snakeSprites = [];
        
        // Create new sprites
        this.snake.forEach((seg, i) => {
            const sprite = this.add.rectangle(
                seg.x * this.TILE_SIZE + this.TILE_SIZE / 2,
                seg.y * this.TILE_SIZE + this.TILE_SIZE / 2,
                this.TILE_SIZE - 4,
                this.TILE_SIZE - 4,
                i === 0 ? 0xff0000 : 0xdc2626 // Head brighter red
            );
            sprite.setDepth(12);
            this.snakeSprites.push(sprite);
        });
    }
    
    moveSnake() {
        if (this.isGameOver || this.isWon || this.snake.length === 0) return;
        
        const head = this.snake[0];
        
        // Find direction toward player (simple pathfinding)
        let dx = this.playerPos.x - head.x;
        let dy = this.playerPos.y - head.y;
        
        // Choose direction (not too aggressive - 50% chance to move randomly)
        let nextX = head.x;
        let nextY = head.y;
        
        if (Math.random() < 0.5) {
            // Move toward player
            if (Math.abs(dx) > Math.abs(dy)) {
                nextX = head.x + Math.sign(dx);
            } else if (dy !== 0) {
                nextY = head.y + Math.sign(dy);
            } else {
                nextX = head.x + Math.sign(dx);
            }
        } else {
            // Random direction
            const dirs = [[1,0], [-1,0], [0,1], [0,-1]];
            const dir = dirs[Math.floor(Math.random() * dirs.length)];
            nextX = head.x + dir[0];
            nextY = head.y + dir[1];
        }
        
        // Bounds check
        if (nextX < 0 || nextX >= this.GRID_SIZE || nextY < 0 || nextY >= this.GRID_SIZE) return;
        
        const cell = this.grid[nextY][nextX];
        
        // Can't move through walls
        if (cell === 1) return;
        
        // Check if eating number
        if (cell >= 2 && cell <= 10) {
            // Positive number - grow
            this.snake.unshift({x: nextX, y: nextY});
            this.grid[nextY][nextX] = 0;
            this.updateTileVisual(nextX, nextY);
            this.spawnNewNumber();
        } else if (cell >= 12 && cell <= 16) {
            // Negative number - shrink
            if (this.snake.length > 1) {
                this.snake.pop();
            }
            this.snake.unshift({x: nextX, y: nextY});
            this.snake.shift(); // Remove the head we just added, net zero movement
            this.grid[nextY][nextX] = 0;
            this.updateTileVisual(nextX, nextY);
            this.spawnNewNumber();
        } else {
            // Normal move
            this.snake.unshift({x: nextX, y: nextY});
            this.snake.pop();
        }
        
        // Check collision with player
        if (this.snake.some(seg => seg.x === this.playerPos.x && seg.y === this.playerPos.y)) {
            this.handleDamage();
        }
        
        this.updateSnakeVisuals();
    }

    generateGrid() {
        this.grid = Array(this.GRID_SIZE).fill().map(() => Array(this.GRID_SIZE).fill(0));
        
        // Minimal QR structure
        for (let y = 0; y < this.GRID_SIZE; y++) {
            for (let x = 0; x < this.GRID_SIZE; x++) {
                if (Math.random() < 0.12) this.grid[y][x] = 1;
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
        
        // Scatter positive numbers (2-10 = digits 1-9)
        let numbersPlaced = 0;
        while(numbersPlaced < 35) {
            const rx = Math.floor(Math.random() * this.GRID_SIZE);
            const ry = Math.floor(Math.random() * this.GRID_SIZE);
            if (this.grid[ry][rx] === 0 && !this.isFinderZone(rx, ry)) {
                const digit = Math.floor(Math.random() * 9) + 1; // 1-9
                this.grid[ry][rx] = digit + 1; // Store as 2-10
                numbersPlaced++;
            }
        }
        
        // Scatter negative numbers (12-16 = -1 to -5)
        let negativeNumbers = 0;
        while(negativeNumbers < 8) {
            const rx = Math.floor(Math.random() * this.GRID_SIZE);
            const ry = Math.floor(Math.random() * this.GRID_SIZE);
            if (this.grid[ry][rx] === 0 && !this.isFinderZone(rx, ry)) {
                const negDigit = Math.floor(Math.random() * 5) + 1; // 1-5
                this.grid[ry][rx] = 11 + negDigit; // Store as 12-16
                negativeNumbers++;
            }
        }
        
        // Scatter hearts (type 17)
        for(let i=0; i<4; i++) {
            const rx = Math.floor(Math.random() * this.GRID_SIZE);
            const ry = Math.floor(Math.random() * this.GRID_SIZE);
            if (this.grid[ry][rx] === 0 && !this.isFinderZone(rx, ry)) {
                this.grid[ry][rx] = 17;
            }
        }
    }
    
    generateTarget() {
        // Target between 25 and 60, but never equal to current sum
        let newTarget;
        do {
            newTarget = Math.floor(Math.random() * 36) + 25;
        } while (newTarget === this.currentSum);
        this.targetNumber = newTarget;
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
        rect.setAlpha(1);
        
        if (type === 1) {
            rect.setFillStyle(0x4a4a4a); // Grigio medio per muri (più visibile)
            rect.setDepth(0);
        } else if (type >= 2 && type <= 10) { // Numbers 1-9
            const digit = type - 1;
            rect.setFillStyle(0x1a1a1a);
            text.setText(digit.toString());
            text.setColor('#06b6d4');
            text.setFontSize(`${this.TILE_SIZE * 0.65}px`);
            rect.setDepth(0);
        } else if (type >= 12 && type <= 16) { // Negative numbers -1 to -5
            const negDigit = -(type - 11);
            rect.setFillStyle(0x1a1a1a);
            text.setText(negDigit.toString());
            text.setColor('#ef4444');
            text.setFontSize(`${this.TILE_SIZE * 0.65}px`);
            rect.setDepth(0);
        } else if (type === 17) { // Heart
            rect.setFillStyle(0x10b981);
            text.setText('♥');
            text.setColor('#ffffff');
            text.setFontSize(`${this.TILE_SIZE * 0.6}px`);
            rect.setDepth(0);
        } else {
            rect.setFillStyle(0x1a1a1a);
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

    rotateWorld() {
        this.currentRotation += 90;
        this.tweens.add({
            targets: this.cameras.main,
            rotation: Phaser.Math.DegToRad(this.currentRotation),
            duration: 1000,
            ease: 'Cubic.easeOut'
        });
        
        // Shuffle numbers after rotation
        this.shuffleNumbers();

        // Change target number after rotation
        this.generateTarget();
    }
    
    spawnNewNumber() {
        // Spawn a new number to replace collected one
        let placed = false;
        let attempts = 0;
        while (!placed && attempts < 50) {
            const rx = Math.floor(Math.random() * this.GRID_SIZE);
            const ry = Math.floor(Math.random() * this.GRID_SIZE);
            if (this.grid[ry][rx] === 0 && !this.isFinderZone(rx, ry) && 
                !(rx === this.playerPos.x && ry === this.playerPos.y) &&
                !this.snake.some(seg => seg.x === rx && seg.y === ry)) {
                // 80% positive, 20% negative
                if (Math.random() < 0.8) {
                    const digit = Math.floor(Math.random() * 9) + 1;
                    this.grid[ry][rx] = digit + 1;
                } else {
                    const negDigit = Math.floor(Math.random() * 5) + 1;
                    this.grid[ry][rx] = 11 + negDigit;
                }
                this.updateTileVisual(rx, ry);
                placed = true;
            }
            attempts++;
        }
    }
    
    spawnHeart() {
        // Respawn heart after collection
        let placed = false;
        let attempts = 0;
        while (!placed && attempts < 50) {
            const rx = Math.floor(Math.random() * this.GRID_SIZE);
            const ry = Math.floor(Math.random() * this.GRID_SIZE);
            if (this.grid[ry][rx] === 0 && !this.isFinderZone(rx, ry) && 
                !(rx === this.playerPos.x && ry === this.playerPos.y) &&
                !this.snake.some(seg => seg.x === rx && seg.y === ry)) {
                this.grid[ry][rx] = 17;
                this.updateTileVisual(rx, ry);
                placed = true;
            }
            attempts++;
        }
    }
    
    shuffleNumbers() {
        // Collect all numbers (but not hearts)
        const numbers = [];
        for (let y = 0; y < this.GRID_SIZE; y++) {
            for (let x = 0; x < this.GRID_SIZE; x++) {
                const cell = this.grid[y][x];
                if ((cell >= 2 && cell <= 10) || (cell >= 12 && cell <= 16)) {
                    numbers.push({ x, y, value: cell });
                }
            }
        }
        
        // Clear old positions
        numbers.forEach(n => {
            this.grid[n.y][n.x] = 0;
            this.updateTileVisual(n.x, n.y);
        });
        
        // Shuffle and place in new random positions
        const shuffled = numbers.sort(() => Math.random() - 0.5);
        shuffled.forEach(num => {
            let placed = false;
            let attempts = 0;
            while (!placed && attempts < 100) {
                const rx = Math.floor(Math.random() * this.GRID_SIZE);
                const ry = Math.floor(Math.random() * this.GRID_SIZE);
                if (this.grid[ry][rx] === 0 && !this.isFinderZone(rx, ry) && 
                    !(rx === this.playerPos.x && ry === this.playerPos.y)) {
                    this.grid[ry][rx] = num.value;
                    this.updateTileVisual(rx, ry);
                    placed = true;
                }
                attempts++;
            }
        });
    }
    
    isFinderZone(x, y) {
        if (x <= 6 && y <= 6) return true;
        if (x >= this.GRID_SIZE - 7 && y <= 6) return true;
        if (x <= 6 && y >= this.GRID_SIZE - 7) return true;
        return false;
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
        if (this.isMoving || this.isGameOver || this.isWon || this.inputProcessed) return;

        this.inputProcessed = true;

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
        
        // Check for collectibles
        if (cell >= 2 && cell <= 10) {
            const digit = cell - 1;
            const newSum = this.currentSum + digit;
            
            if (newSum > this.targetNumber) {
                // Exceeded target - lose life but keep counter
                this.handleDamage();
                this.isMoving = false;
                return;
            }
            
            this.currentSum = newSum;
            this.grid[nextY][nextX] = 0;
            this.updateTileVisual(nextX, nextY);
            this.game.events.emit('play-sound', 'collect');
            this.spawnNewNumber();
            
            if (this.currentSum === this.targetNumber) {
                this.handleWin();
                return;
            }
        } else if (cell >= 12 && cell <= 16) {
            // Negative number - subtract
            const negDigit = -(cell - 11);
            this.currentSum += negDigit;
            this.grid[nextY][nextX] = 0;
            this.updateTileVisual(nextX, nextY);
            this.game.events.emit('play-sound', 'collect');
            this.spawnNewNumber();
            
            if (this.currentSum === this.targetNumber) {
                this.handleWin();
                return;
            }
        } else if (cell === 17) {
            // Heart
            this.lives++;
            this.grid[nextY][nextX] = 0;
            this.updateTileVisual(nextX, nextY);
            this.game.events.emit('play-sound', 'heal');
            this.spawnHeart();
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

    update(time, delta) {
        if (this.isGameOver || this.isWon) return;

        // Reset input flag
        if (!this.cursors.left.isDown && !this.cursors.right.isDown && 
            !this.cursors.up.isDown && !this.cursors.down.isDown &&
            !this.wasd.left.isDown && !this.wasd.right.isDown && 
            !this.wasd.up.isDown && !this.wasd.down.isDown) {
            this.inputProcessed = false;
        }

        // Keyboard inputs
        if (!this.isMoving) {
            if (this.cursors.left.isDown || this.wasd.left.isDown) this.handleInput(-1, 0);
            else if (this.cursors.right.isDown || this.wasd.right.isDown) this.handleInput(1, 0);
            else if (this.cursors.up.isDown || this.wasd.up.isDown) this.handleInput(0, -1);
            else if (this.cursors.down.isDown || this.wasd.down.isDown) this.handleInput(0, 1);
        }

        // Timer - initialize on first frame
        if (!this.nextRotationTime) {
            this.nextRotationTime = time + this.ROTATION_INTERVAL;
        }
        const timeLeft = Math.max(0, Math.ceil((this.nextRotationTime - time) / 1000));
        
        // Check if rotation should happen
        if (time >= this.nextRotationTime) {
            this.rotateWorld();
            this.nextRotationTime = time + this.ROTATION_INTERVAL;
        }
        
        const display = `${this.currentSum}/${this.targetNumber}`;
        this.game.events.emit('update-ui', {
            lives: this.lives,
            level: 7,
            timeLeft: `${display} • ${timeLeft}s`
        });
        
        // Sync text rotation
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

    handleWin() {
        this.isWon = true;
        this.cameras.main.flash(500, 0, 255, 100);
        this.game.events.emit('play-sound', 'win');
        this.game.events.emit('game-over', { win: true, nextLevel: 8 });
        this.scene.pause();
    }

    updateUI() {
        if (!this.nextRotationTime) return;
        const time = this.time.now;
        const timeLeft = Math.max(0, Math.ceil((this.nextRotationTime - time) / 1000));
        const display = `${this.currentSum}/${this.targetNumber}`;
        this.game.events.emit('update-ui', {
            lives: this.lives,
            level: 7,
            timeLeft: `${display} • ${timeLeft}s`
        });
    }
}