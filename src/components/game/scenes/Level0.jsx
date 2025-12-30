import Phaser from 'phaser';

export default class Level0 extends Phaser.Scene {
    constructor() {
        super({ key: 'Level0' });
    }

    create() {
        // --- Constants ---
        this.GRID_SIZE = 21;
        this.TILE_SIZE = Math.min(this.scale.width, this.scale.height) / this.GRID_SIZE;

        // --- State ---
        this.playerPos = { x: 10, y: 10 };
        this.grid = []; 
        this.tileSprites = []; 
        this.isMoving = false;
        this.lives = 999;
        
        this.phase = 0; // 0: Single swipe, 0.5: Hold direction, 1: Wrap, 2: Rotation, 3: End
        this.hasTestedHold = false;
        this.currentRotation = 0;
        this.rotationIntroActive = false;
        this.rotationIntroFirstSpinDone = false;

        this.arrowIndicators = []; // Visual arrows for wrap-around

        this.cameras.main.setBackgroundColor('#0a0a0a');
        
        this.generateGrid();
        this.drawGrid();
        this.setupPlayer();
        this.setupInputs();
        this.updateUI();

        this.time.delayedCall(500, () => {
            if (this.scene.isActive('Level0')) {
                this.showTutorialText("🎮 TUTORIAL: MOVIMENTO BASE\n\n✨ FAI SWIPE → PER MUOVERTI\nRAGGIUNGI LA CELLA VERDE!", 8000);
                this.showDirectionalArrow('right');
            }
        });
    }

    showTutorialText(text, duration = 4500) {
        
        if (this.tutorialText) {
            this.tutorialText.destroy();
            this.tutorialText = null;
        }


        const paddingX = 18;
        const paddingY = 12;

        this.tutorialText = this.add.text(0, 0, text, {
            fontSize: '18px',
            fill: '#06b6d4',
            fontFamily: 'monospace',
            align: 'center',
            fontStyle: 'bold',
            backgroundColor: '#000000dd',
            padding: { x: paddingX, y: paddingY },
            wordWrap: { width: Math.min(this.scale.width - 40, 520), useAdvancedWrap: true }
        })
        .setOrigin(0.5)
        .setDepth(100)
        .setScrollFactor(0); // ✅ resta “attaccato” allo schermo (camera space)

        // ✅ posiziona sempre al centro in alto (ma dentro l’area visibile)
        this.positionTutorialText();

        this.tweens.add({
            targets: this.tutorialText,
            alpha: { from: 0, to: 1 },
            duration: 300
        });

        // Se duration è 0 o null → NON auto-hide
        if (duration && duration > 0) {
        this.time.delayedCall(duration, () => {
            if (this.tutorialText) {
            this.tweens.add({
                targets: this.tutorialText,
                alpha: 0,
                duration: 300,
            onComplete: () => {
            if (this.tutorialText) {
                this.tutorialText.destroy();
                this.tutorialText = null;
            }
            }
            });
            }
        });
        }

    }

    positionTutorialText() {
        if (!this.tutorialText || !this.tutorialText.scene) return;

        const w = this.scale.width;
        const h = this.scale.height;

        // Durante/ dopo rotazioni: mettilo al centro per evitare tagli ai bordi
        const inRotationPhase = this.phase >= 2;

        const x = w / 2;
        const y = inRotationPhase ? (h / 2) : Math.max(90, h * 0.18);

        this.tutorialText.setPosition(x, y);

        // Contro-rotazione: testo sempre dritto
        this.tutorialText.setRotation(-this.cameras.main.rotation);

        // Se sei in fase rotazione, riduci un po' la larghezza effettiva (safe area)
        // (così non viene “mangiato” dagli angoli durante la rotazione)
        const wrapWidth = inRotationPhase ? Math.min(w * 0.70, 420) : Math.min(w - 40, 520);

        // aggiorna solo se cambia (evita updateText continui e bug durante destroy)
        if (this.tutorialText._lastWrapWidth !== wrapWidth) {
        this.tutorialText.setWordWrapWidth(wrapWidth, true);
        this.tutorialText._lastWrapWidth = wrapWidth;
        }

    }

    shutdown() {
        if (this.tutorialText) {
            this.tutorialText.destroy();
            this.tutorialText = null;
        }
        this.clearArrowIndicators();
    }
    
    clearArrowIndicators() {
        this.arrowIndicators.forEach(arrow => arrow.destroy());
        this.arrowIndicators = [];
    }
    
    showDirectionalArrow(direction) {
        this.clearArrowIndicators();
        
        const centerX = this.scale.width / 2;
        const centerY = this.scale.height / 2;
        
        let arrow, x, y;
        
        if (direction === 'right') {
            arrow = '→';
            x = centerX + 80;
            y = centerY;
        } else if (direction === 'all') {
            // Show all 4 directions
            const arrows = [
                { text: '→', x: centerX + 80, y: centerY },
                { text: '←', x: centerX - 80, y: centerY },
                { text: '↑', x: centerX, y: centerY - 80 },
                { text: '↓', x: centerX, y: centerY + 80 }
            ];
            
            arrows.forEach(arr => {
                const arrowText = this.add.text(arr.x, arr.y, arr.text, {
                    fontSize: '64px',
                    color: '#06b6d4',
                    fontStyle: 'bold'
                }).setOrigin(0.5).setDepth(98);
                
                this.arrowIndicators.push(arrowText);
                
                this.tweens.add({
                    targets: arrowText,
                    scale: { from: 1, to: 1.4 },
                    alpha: { from: 0.6, to: 1 },
                    duration: 1000,
                    yoyo: true,
                    repeat: -1,
                    ease: 'Sine.easeInOut'
                });
            });
            return;
        }
        
        if (arrow) {
            const arrowText = this.add.text(x, y, arrow, {
                fontSize: '64px',
                color: '#06b6d4',
                fontStyle: 'bold'
            }).setOrigin(0.5).setDepth(98);
            
            this.arrowIndicators.push(arrowText);
            
            // Pulsing and moving animation
            this.tweens.add({
                targets: arrowText,
                scale: { from: 1, to: 1.4 },
                alpha: { from: 0.6, to: 1 },
                duration: 1000,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
        }
    }
    
    showWrapArrows() {
        this.clearArrowIndicators();
        
        // Top arrow (pointing up, wraps to bottom)
        const topArrow = this.add.text(
            this.scale.width / 2, 
            50, 
            '↑', 
            { fontSize: '48px', color: '#22c55e', fontStyle: 'bold' }
        ).setOrigin(0.5).setDepth(99);
        
        // Bottom arrow (pointing down, wraps to top)
        const bottomArrow = this.add.text(
            this.scale.width / 2, 
            this.scale.height - 50, 
            '↓', 
            { fontSize: '48px', color: '#22c55e', fontStyle: 'bold' }
        ).setOrigin(0.5).setDepth(99);
        
        // Left arrow (pointing left, wraps to right)
        const leftArrow = this.add.text(
            50, 
            this.scale.height / 2, 
            '←', 
            { fontSize: '48px', color: '#22c55e', fontStyle: 'bold' }
        ).setOrigin(0.5).setDepth(99);
        
        // Right arrow (pointing right, wraps to left)
        const rightArrow = this.add.text(
            this.scale.width - 50, 
            this.scale.height / 2, 
            '→', 
            { fontSize: '48px', color: '#22c55e', fontStyle: 'bold' }
        ).setOrigin(0.5).setDepth(99);
        
        this.arrowIndicators.push(topArrow, bottomArrow, leftArrow, rightArrow);
        
        // Pulsing animation
        this.arrowIndicators.forEach(arrow => {
            this.tweens.add({
                targets: arrow,
                scale: { from: 1.2, to: 1.5 },
                alpha: { from: 0.7, to: 1 },
                duration: 800,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
        });
    }

    generateGrid() {
        this.grid = Array(this.GRID_SIZE).fill().map(() => Array(this.GRID_SIZE).fill(0));
        
        // Minimal walls for tutorial
        for (let y = 0; y < this.GRID_SIZE; y++) {
            for (let x = 0; x < this.GRID_SIZE; x++) {
                if (Math.random() < 0.08) this.grid[y][x] = 1;
            }
        }

        // Finder Patterns (QR Code style)
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

        // Clear spawn and first goal
        this.grid[10][10] = 0; 
        this.grid[15][15] = 3;
    }

    drawGrid() {
        this.tileSprites = [];
        const size = this.TILE_SIZE - 1; 

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
            rect.setFillStyle(0x333333);
            rect.setDepth(0);
        } else if (type === 3) {
            rect.setFillStyle(0x22c55e);
            rect.setDepth(20);
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

    setupInputs() {
        this.cursors = this.input.keyboard.createCursorKeys();
        this.wasd = this.input.keyboard.addKeys({
            up: Phaser.Input.Keyboard.KeyCodes.W,
            down: Phaser.Input.Keyboard.KeyCodes.S,
            left: Phaser.Input.Keyboard.KeyCodes.A,
            right: Phaser.Input.Keyboard.KeyCodes.D
        });

        this.currentDirection = { x: 0, y: 0 };
        this.nextDirection = { x: 0, y: 0 };
        this.lastMoveTime = 0;
        this.MOVE_SPEED = 220;

        this.input.on('pointerdown', (pointer) => {
            this.touchStartX = pointer.x;
            this.touchStartY = pointer.y;
        });

        this.input.on('pointerup', (pointer) => {
            const dx = pointer.x - this.touchStartX;
            const dy = pointer.y - this.touchStartY;
            const threshold = 20;

            if (Math.abs(dx) > threshold || Math.abs(dy) > threshold) {
                if (this.phase === 0) {
                    // Phase 0: Discrete movement
                    if (Math.abs(dx) > Math.abs(dy)) {
                        this.attemptMove(dx > 0 ? 1 : -1, 0);
                    } else {
                        this.attemptMove(0, dy > 0 ? 1 : -1);
                    }
                } else {
                    // Phase 0.5+: Continuous movement
                    if (Math.abs(dx) > Math.abs(dy)) {
                        this.handleInput(dx > 0 ? 1 : -1, 0);
                    } else {
                        this.handleInput(0, dy > 0 ? 1 : -1);
                    }
                }
            }
        });
    }
    
    setDirection(dx, dy) {
        this.nextDirection = { x: dx, y: dy };
    }

    handleInput(dx, dy) {
        const rad = -this.cameras.main.rotation;
        const gridDx = Math.round(dx * Math.cos(rad) - dy * Math.sin(rad));
        const gridDy = Math.round(dx * Math.sin(rad) + dy * Math.cos(rad));
        this.setDirection(gridDx, gridDy);
    }

    update(time, delta) {
        // Phase 0: Discrete movement only
        if (this.phase === 0) {
            if (!this.isMoving) {
                if (this.cursors.left.isDown || this.wasd.left.isDown) this.attemptMove(-1, 0);
                else if (this.cursors.right.isDown || this.wasd.right.isDown) this.attemptMove(1, 0);
                else if (this.cursors.up.isDown || this.wasd.up.isDown) this.attemptMove(0, -1);
                else if (this.cursors.down.isDown || this.wasd.down.isDown) this.attemptMove(0, 1);
            }
        }
        // Phase 0.5+: Continuous movement
        else {
            if (this.cursors.left.isDown || this.wasd.left.isDown) this.handleInput(-1, 0);
            else if (this.cursors.right.isDown || this.wasd.right.isDown) this.handleInput(1, 0);
            else if (this.cursors.up.isDown || this.wasd.up.isDown) this.handleInput(0, -1);
            else if (this.cursors.down.isDown || this.wasd.down.isDown) this.handleInput(0, 1);

            if (time - this.lastMoveTime > this.MOVE_SPEED) {
                this.movePlayerContinuous();
                this.lastMoveTime = time;
            }
        }

        // Phase 2+: Rotation
        if (this.phase >= 2) {
            const interval = 5000;
            if (!this.nextRotationTime) this.nextRotationTime = time + interval;
            if (time > this.nextRotationTime) {
                this.rotateWorld();
                this.nextRotationTime = time + interval;
            }
            const timeLeft = Math.max(0, Math.ceil((this.nextRotationTime - time) / 1000));
            this.updateUI(timeLeft);
            
            // ✅ Tutorial text sempre in screen-space: centrato e dritto
            if (this.tutorialText) {
                this.positionTutorialText();
            }
        }
    }
    
    movePlayerContinuous() {
        if (this.currentDirection.x === 0 && this.currentDirection.y === 0 && 
            (this.nextDirection.x !== 0 || this.nextDirection.y !== 0)) {
            this.currentDirection = { ...this.nextDirection };
        } else if (this.nextDirection.x !== 0 || this.nextDirection.y !== 0) {
            this.currentDirection = { ...this.nextDirection };
        }

        if (this.currentDirection.x === 0 && this.currentDirection.y === 0) return;

        let nextX = this.playerPos.x + this.currentDirection.x;
        let nextY = this.playerPos.y + this.currentDirection.y;

        // Wrap Logic
        if (nextX < 0) nextX = this.GRID_SIZE - 1;
        if (nextX >= this.GRID_SIZE) nextX = 0;
        if (nextY < 0) nextY = this.GRID_SIZE - 1;
        if (nextY >= this.GRID_SIZE) nextY = 0;

        const cell = this.grid[nextY][nextX];
        
        if (cell !== 1) {
            this.playerPos = { x: nextX, y: nextY };
            
            // Update player symbol
            if (this.currentDirection.x > 0) this.playerSymbol.setText('>');
            else if (this.currentDirection.x < 0) this.playerSymbol.setText('<');
            else if (this.currentDirection.y > 0) this.playerSymbol.setText('v');
            else if (this.currentDirection.y < 0) this.playerSymbol.setText('^');
            
            if (cell === 3) this.handleWin();
            
            this.updatePlayerVisuals();
        }
    }
    
    updatePlayerVisuals() {
        this.player.x = this.playerPos.x * this.TILE_SIZE + this.TILE_SIZE / 2;
        this.player.y = this.playerPos.y * this.TILE_SIZE + this.TILE_SIZE / 2;
        this.playerSymbol.x = this.playerPos.x * this.TILE_SIZE + this.TILE_SIZE / 2;
        this.playerSymbol.y = this.playerPos.y * this.TILE_SIZE + this.TILE_SIZE / 2;
    }

    rotateWorld() {
        this.currentRotation += 90;
        this.tweens.add({
            targets: this.cameras.main,
            rotation: Phaser.Math.DegToRad(this.currentRotation),
            duration: 1000,
            ease: 'Cubic.easeOut'
        });
        if (this.rotationIntroActive && !this.rotationIntroFirstSpinDone) {
            this.rotationIntroFirstSpinDone = true;
            this.rotationIntroActive = false;

            // Fade-out immediato quando parte la prima rotazione
            if (this.tutorialText) {
                this.tweens.add({
                targets: this.tutorialText,
                alpha: 0,
                duration: 250,
                onComplete: () => {
                    if (this.tutorialText) {
                    this.tutorialText.destroy();
                    this.tutorialText = null;
                    }
                }
                });
            }
        }
        this.relocateEndPoint();
    }

    relocateEndPoint() {
        // Clear old end
        for(let y=0; y<this.GRID_SIZE; y++) {
            for(let x=0; x<this.GRID_SIZE; x++) {
                if(this.grid[y][x] === 3) {
                    this.grid[y][x] = 0;
                    this.updateTileVisual(x, y);
                }
            }
        }
        // Random new end
        let placed = false;
        while(!placed) {
            const rx = Math.floor(Math.random() * this.GRID_SIZE);
            const ry = Math.floor(Math.random() * this.GRID_SIZE);
            if (this.grid[ry][rx] === 0 && (rx !== this.playerPos.x || ry !== this.playerPos.y) && !this.isFinderZone(rx, ry)) {
                this.grid[ry][rx] = 3;
                this.updateTileVisual(rx, ry);
                placed = true;
            }
        }
    }

    isFinderZone(x, y) {
        if (x <= 6 && y <= 6) return true;
        if (x >= this.GRID_SIZE - 7 && y <= 6) return true;
        if (x <= 6 && y >= this.GRID_SIZE - 7) return true;
        return false;
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
        
        if (cell === 1) return; // Wall

        this.isMoving = true;
        this.playerPos = { x: nextX, y: nextY };
        
        // Update player symbol
        if (dx > 0) this.playerSymbol.setText('>');
        else if (dx < 0) this.playerSymbol.setText('<');
        else if (dy > 0) this.playerSymbol.setText('v');
        else if (dy < 0) this.playerSymbol.setText('^');
        
        // Animate movement
        this.tweens.add({
            targets: [this.player, this.playerSymbol],
            x: nextX * this.TILE_SIZE + this.TILE_SIZE / 2,
            y: nextY * this.TILE_SIZE + this.TILE_SIZE / 2,
            duration: 150,
            ease: 'Power2',
            onComplete: () => {
                this.isMoving = false;
                if (cell === 3) this.handleWin();
            }
        });
    }

    handleWin() {
        if (this.phase === 0) {
            this.phase = 0.5;
            this.cameras.main.flash(300, 0, 255, 100);
            this.clearArrowIndicators();
            this.showTutorialText("✅ PERFETTO! In alcuni livelli\n\n🎯 MUOVI → ← ↑ ↓\nPER MOVIMENTO CONTINUO!", 8000);
            this.showDirectionalArrow('all');
            this.relocateEndPoint();
        } else if (this.phase === 0.5) {
            this.phase = 1;
            this.cameras.main.flash(300, 0, 255, 100);
            this.clearArrowIndicators();
            this.showTutorialText("✅ FANTASTICO! VELOCITÀ SBLOCCATA\n\n🌀 ESCI DAI BORDI DELLO SCHERMO\nAPPARIRAI DALL'ALTRO LATO!", 8000);
            this.showWrapArrows();
            this.relocateEndPoint();
        } else if (this.phase === 1) {
            this.phase = 2;
            this.cameras.main.flash(300, 0, 255, 100);
            this.clearArrowIndicators();
            this.showTutorialText(
                  "✅ OTTIMO! WRAP-AROUND PADRONEGGIATO\n\n🔄 ORA IL MONDO RUOTERÀ\nSEGUI IL TIMER E ADATTATI!", 0 // <- resta finché non lo togliamo noi
            );
            this.rotationIntroActive = true;
            this.rotationIntroFirstSpinDone = false;
            this.relocateEndPoint();
        } else if (this.phase === 2) {
            this.phase = 3;
            this.clearArrowIndicators();
            this.cameras.main.flash(500, 255, 215, 0);
            this.showTutorialText("🎉 TUTORIAL COMPLETATO! 🎉\n\n⚡ SEI PRONTO PER LA SFIDA\nIL VERO GIOCO INIZIA ORA!", 4000);
            this.time.delayedCall(4000, () => {
                this.game.events.emit('game-over', { win: true, nextLevel: 1 });
            });
        }
    }

    updateUI(timeLeft = 7) {
        this.game.events.emit('update-ui', {
            lives: 999,
            level: 0,
            timeLeft: this.phase >= 2 ? timeLeft : '-'
        });
    }
}