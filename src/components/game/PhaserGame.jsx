import React, { useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';
import Level0 from './scenes/Level0';
import Level1 from './scenes/Level1';
import Level2 from './scenes/Level2';
import Level3 from './scenes/Level3';
import Level4 from './scenes/Level4';
import Level5 from './scenes/Level5';
import Level6 from './scenes/Level6';
import Level7 from './scenes/Level7';
import Level8 from './scenes/Level8';
import Level9 from './scenes/Level9';

import { Settings, Play, Volume2, VolumeX, Home, Heart, Info } from 'lucide-react';

export default function PhaserGame() {
    const gameRef = useRef(null);
    const containerRef = useRef(null);

    const [uiState, setUiState] = useState({
        lives: 3,
        level: 0,
        timeLeft: 7,
        status: 'menu', // menu, playing, won, lost
        binaryTarget: null,
        binaryCurrent: null,
        patternTarget: null,
        patternCurrent: 0
    });

    const [settings, setSettings] = useState({
        audio: true,
        moveSpeed: 220
    });

    const [showSettings, setShowSettings] = useState(false);
    // Track target level to start game after render
    const [pendingLevel, setPendingLevel] = useState(null);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (gameRef.current) {
                gameRef.current.destroy(true);
                gameRef.current = null;
            }
        };
    }, []);

    // Effect to start game when pendingLevel is set AND container is ready
    useEffect(() => {
        if (pendingLevel && containerRef.current && uiState.status === 'playing') {
            startGameInstance(pendingLevel);
            setPendingLevel(null);
        }
    }, [pendingLevel, uiState.status]);

    const startGameInstance = (levelKey) => {
        if (gameRef.current) {
            // Just stop all scenes, don't destroy the game between levels
            gameRef.current.scene.scenes.forEach(scene => {
                if (scene.scene.isActive()) {
                    scene.scene.stop();
                }
            });
            // Update registry and start new scene immediately
            gameRef.current.registry.set('lives', uiState.lives);
            gameRef.current.scene.start(levelKey);
            return;
        }

        const config = {
            type: Phaser.AUTO,
            parent: containerRef.current,
            width: 550, // Internal resolution
            height: 550,
            backgroundColor: '#ffffff',
            scene: [Level0, Level1, Level2, Level3, Level4, Level5, Level6, Level7, Level8, Level9],
            physics: { default: 'arcade', arcade: { debug: false } },
            scale: { 
                mode: Phaser.Scale.FIT, // Auto-scale to fit container
                autoCenter: Phaser.Scale.CENTER_BOTH,
                width: 550,
                height: 550
            },
            render: { pixelArt: true }
        };

        gameRef.current = new Phaser.Game(config);
        
        setTimeout(() => {
            if(gameRef.current) {
                gameRef.current.registry.set('moveSpeed', settings.moveSpeed);
                gameRef.current.registry.set('audio', settings.audio);
                gameRef.current.registry.set('lives', uiState.lives);
                
                // Set up event listeners BEFORE starting the scene to ensure we catch initial events (like update-binary)
                gameRef.current.events.on('update-ui', (data) => setUiState(prev => ({ ...prev, ...data })));

                gameRef.current.events.on('update-binary', (data) => {
                    setUiState(prev => ({ 
                        ...prev, 
                        binaryTarget: data.target, 
                        binaryCurrent: data.current 
                    }));
                });

                gameRef.current.events.on('update-pattern', (data) => {
                    setUiState(prev => ({ 
                        ...prev, 
                        patternTarget: data.pattern, 
                        patternCurrent: data.current 
                    }));
                });

                gameRef.current.events.on('game-over', ({ win, nextLevel }) => {
                    playSound(win ? 'win' : 'loss');
                    // Clear all active scenes before showing game over
                    if (gameRef.current && gameRef.current.scene) {
                        gameRef.current.scene.scenes.forEach(scene => {
                            if (scene.scene.isActive() && scene.scene.key !== levelKey) {
                                scene.scene.stop();
                            }
                        });
                    }
                    setUiState(prev => ({ 
                        ...prev, 
                        status: win ? 'won' : 'lost',
                        nextLevel: win ? nextLevel : null,
                        binaryTarget: null,
                        binaryCurrent: null,
                        patternTarget: null,
                        patternCurrent: 0
                    }));
                });

                gameRef.current.events.on('play-sound', (type) => {
                    playSound(type);
                });

                // Stop all scenes and immediately start target scene
                gameRef.current.scene.scenes.forEach(scene => {
                    if (scene.scene.isActive() && scene.scene.key !== levelKey) {
                        scene.scene.stop();
                    }
                });

                gameRef.current.scene.start(levelKey);
            }
        }, 100);
    };

    const initGame = (levelKey, lives = 3) => {
        // First switch UI to playing to render the container
        const levelNum = parseInt(levelKey.replace('Level', ''));
        setUiState(prev => ({ 
            ...prev, 
            status: 'playing', 
            level: isNaN(levelNum) ? 0 : levelNum, 
            lives: lives,
            binaryTarget: null,
            binaryCurrent: null,
            patternTarget: null,
            patternCurrent: 0
        }));
        // Then set pending level to trigger the effect
        setPendingLevel(levelKey);
    };

    const audioCtxRef = useRef(null);

    const playSound = (type) => {
        if (!settings.audio) return;
        
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
        } else if (type === 'collect' || type === 'heal') {
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
        } else if (type === 'loss' || type === 'damage') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(150, now);
            osc.frequency.linearRampToValueAtTime(50, now + 0.4);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.4);
            osc.start(now);
            osc.stop(now + 0.4);
        }
    };

    const handleStart = () => {
        initGame('Level1', 3);
    };

    const handleTutorial = () => {
        initGame('Level0', 3);
    };
    
    const handleMenu = () => {
        if (gameRef.current) {
            // Stop all scenes cleanly
            gameRef.current.scene.scenes.forEach(scene => {
                if (scene.scene.isActive()) {
                    scene.scene.stop();
                }
            });
            gameRef.current.destroy(true);
            gameRef.current = null;
        }
        setUiState(prev => ({ ...prev, status: 'menu' }));
        // Reset settings to default
        setSettings({
            audio: true,
            moveSpeed: 220
        });
    };

    return (
        <div className="flex flex-col items-center justify-start pt-12 md:justify-center md:pt-0 w-full h-[100dvh] bg-neutral-950 text-white font-mono selection:bg-cyan-500 selection:text-black overflow-hidden">
            {/* Header UI (Only visible when playing) */}
            {uiState.status === 'playing' && (
              <div className="w-full max-w-[550px] flex flex-col">
                <div className="w-full flex justify-between items-center px-4 py-2 shrink-0">
                    <div className="flex items-center gap-2 md:gap-4">
                        <div className="flex items-center gap-3">
                            <div className={`w-3 h-3 rounded-full ${uiState.timeLeft < 3 && typeof uiState.timeLeft === 'number' ? 'bg-red-500 animate-pulse' : 'bg-cyan-500'}`} />
                            <span className="text-xl font-bold">{typeof uiState.timeLeft === 'number' ? uiState.timeLeft + 's' : uiState.timeLeft}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 md:gap-4">
                        <div className="text-neutral-400 text-sm md:text-base">LIV {uiState.level}</div>
                        <div className="flex gap-1">
                            {uiState.lives > 5 ? (
                                <span className="text-xl text-cyan-400 font-bold">∞</span>
                            ) : (
                                [...Array(3)].map((_, i) => (
                                    <Heart 
                                        key={i} 
                                        className={`w-6 h-6 ${i < uiState.lives ? 'fill-red-500 text-red-500' : 'fill-neutral-800 text-neutral-800'}`} 
                                    />
                                ))
                            )}
                        </div>
                        <button onClick={handleMenu} variant="ghost" size="default" className="ml-2 text-neutral-500 hover:text-neutral-300 hover:bg-transparent flex gap-2 px-3">
                            <Home className="w-4 h-4" /> <span className="text-xs font-bold tracking-widest">MENU</span>
                        </button>
                        </div>
                        </div>

                        {/* Binary Code Display - Prominent */}
                        {uiState.binaryTarget && (
                        <div className="w-full bg-neutral-900 border-y border-neutral-800 py-4 mb-2 flex flex-col items-center justify-center relative z-50 shadow-lg">
                        <span className="text-[10px] text-neutral-400 uppercase tracking-[0.2em] mb-1 font-bold">DECODIFICA SEQUENZA</span>
                        <div className="font-mono text-3xl tracking-[0.15em] flex items-center bg-black/50 px-4 py-1 rounded">
                            <span className="text-cyan-400 font-black drop-shadow-[0_0_10px_rgba(34,211,238,0.8)]">{uiState.binaryCurrent}</span>
                            <span className="text-neutral-600 font-bold">{uiState.binaryTarget.substring(uiState.binaryCurrent.length || 0)}</span>
                        </div>
                        </div>
                        )}


                        </div>
                        )}

            {/* Menu / Game Container */}
            <div className="relative w-full max-w-[550px] flex justify-center p-0 md:p-4">
                {/* Always render container but hide it when in menu to ensure ref exists for init */}
                <div className={`${uiState.status === 'menu' ? 'hidden' : 'block'} relative shadow-2xl w-full aspect-square`}>
                     <div ref={containerRef} className="rounded-sm border-2 border-neutral-800 overflow-hidden w-full h-full" />
                     
                     {/* Status Overlays */}
                    {(uiState.status === 'won' || uiState.status === 'lost') && (
                        <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center backdrop-blur-sm z-20 animate-in fade-in duration-300">
                            <h2 className={`text-3xl md:text-4xl text-center px-4 leading-tight font-black mb-4 ${uiState.status === 'won' ? 'text-green-500' : 'text-red-500'}`}>
                                {uiState.status === 'won' ? 'LIVELLO COMPLETATO' : 'GAME OVER'}
                            </h2>
                            {uiState.status === 'won' && uiState.nextLevel && (
                                <div className="mb-8 p-6 bg-gradient-to-br from-cyan-900/90 to-purple-900/90 border-2 border-cyan-400 shadow-lg shadow-cyan-500/50 text-left max-w-md w-full animate-pulse">
                                    <h3 className="text-cyan-300 font-black uppercase text-sm tracking-widest mb-3 flex items-center gap-2 animate-bounce">
                                        <Info className="w-5 h-5" /> ⚠️ PROSSIMO LIVELLO ⚠️
                                    </h3>
                                    <p className="text-yellow-300 text-lg font-black mb-3 drop-shadow-lg">
                                        {uiState.nextLevel === 1 && "🔴 IL GLITCH SI RISVEGLIA"}
                                        {uiState.nextLevel === 2 && "🔫 TORRETTE DIFENSIVE"}
                                        {uiState.nextLevel === 3 && "⚡ ACCELERAZIONE TOTALE"}
                                        {uiState.nextLevel === 4 && "🌊 IL FLUSSO"}
                                        {uiState.nextLevel === 5 && "💾 CODICE BINARIO"}
                                        {uiState.nextLevel === 6 && "🔥 LA SORGENTE"}
                                        {uiState.nextLevel === 7 && "🔢 ARITHMETIC"}
                                        {uiState.nextLevel === 8 && "🧠 MEMORIA DIREZIONALE"}
                                        {uiState.nextLevel === 9 && "🎯 SEQUENZA SIMBOLI - FINALE"}
                                        </p>
                                        <p className="text-white text-sm font-medium leading-relaxed bg-black/40 p-3 rounded border border-cyan-500/30">
                                        {uiState.nextLevel === 1 && "Il glitch rosso consuma la mappa. Corri."}
                                        {uiState.nextLevel === 2 && "Torrette sparano proiettili. Schiva."}
                                        {uiState.nextLevel === 3 && "Tutto più veloce. Glitch aggressivi."}
                                        {uiState.nextLevel === 4 && "FLUSSO letale, CORRI!!"}
                                        {uiState.nextLevel === 5 && "Raccogli 0 e 1 nell'ordine corretto. 3 Cannoni sparano."}
                                        {uiState.nextLevel === 6 && "Raccogli 5 frammenti viola, entra nella SORGENTE bianca. Onde spirali e muri dall'Architetto."}
                                        {uiState.nextLevel === 7 && "Somma/sottrai numeri. Target cambia ad ogni rotazione (15s). Superi = perdi vita. Serpente rosso ti insegue."}
                                        {uiState.nextLevel === 8 && "Memorizza frecce, ripeti con swipe. Errore = reset."}
                                        {uiState.nextLevel === 9 && "Memorizza 5 simboli e la loro posizione. Raccoglili nell'ordine corretto. 2 Cannoni sparano proiettili."}
                                        </p>
                                </div>
                            )}

                            <p className="text-neutral-500 font-mono mb-6 text-xs">
                                {uiState.status === 'won' ? 'Sistema superato.' : 'Connessione interrotta.'}
                            </p>
                            
                            <div className="flex flex-col gap-3 w-full max-w-xs">
                                {uiState.status === 'won' && uiState.nextLevel && (
                                    <button 
                                        onClick={() => {
                                            const nextKey = `Level${uiState.nextLevel}`;
                                            const nextLives = uiState.nextLevel === 1 ? 3 : uiState.lives;
                                            if (gameRef.current) {
                                                // Stop current scene cleanly
                                                const currentScene = gameRef.current.scene.getScene(`Level${uiState.level}`);
                                                if (currentScene) {
                                                    currentScene.scene.stop();
                                                }
                                            }
                                            // Immediately transition to next level
                                            initGame(nextKey, nextLives);
                                        }} 
                                        className="w-full bg-cyan-500 text-black hover:bg-cyan-400 font-bold py-6 text-lg rounded-none"
                                    >
                                        <Play className="w-5 h-5 mr-2" /> AVVIA LIVELLO {uiState.nextLevel}
                                    </button>
                                )}
                                
                                {uiState.status === 'won' && !uiState.nextLevel && (
                                    <div className="text-yellow-500 font-bold animate-pulse text-xl py-4">
                                        TUTTI I SISTEMI SUPERATI
                                    </div>
                                )}
                                
                                {uiState.status === 'lost' && (
                                    <button onClick={() => initGame(`Level${uiState.level}`, 3)} className="w-full bg-white text-black hover:bg-neutral-200 font-bold py-6 text-lg rounded-none">
                                        <Play className="w-5 h-5 mr-2" /> RIPROVA
                                    </button>
                                )}

                                <button onClick={handleMenu} variant="outline" className="w-full border-neutral-700 text-neutral-400 hover:text-white hover:border-white rounded-none">
                                    <Home className="w-4 h-4 mr-2" /> TORNA AL MENU
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {uiState.status === 'menu' && (
                    <div className="w-full aspect-square bg-neutral-900 border-2 border-neutral-800 flex flex-col items-center justify-center p-8 space-y-6 animate-in fade-in zoom-in duration-300">
                        <div className="text-center space-y-2">
                            <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-600 tracking-tighter">
                                QueRy
                            </h1>
                            <p className="text-neutral-500 text-xs tracking-widest uppercase">Mariella Engine v1.0</p>
                        </div>
                        
                        <div className="space-y-3 w-full max-w-xs z-10">
                            <button onClick={handleStart} className="w-full bg-white text-black hover:bg-cyan-400 hover:text-black font-bold py-6 text-xl rounded-none transition-all">
                                <Play className="mr-2 w-5 h-5" /> INIZIA
                            </button>
                            {/*<button onClick={() => initGame('Level5', 3)} variant="outline" className="w-full border-yellow-700 text-yellow-400 hover:text-yellow-300 hover:border-yellow-500 rounded-none py-4 text-sm">
                                DEBUG: LIVELLO 5
                            </button>*/}
                            {/*<button onClick={() => initGame('Level9', 3)} variant="outline" className="w-full border-yellow-700 text-yellow-400 hover:text-yellow-300 hover:border-yellow-500 rounded-none py-4 text-sm">
                                DEBUG: LIVELLO 9
                            </button>*/}
                            <button onClick={handleTutorial} variant="outline" className="w-full border-neutral-700 text-neutral-400 hover:text-white hover:border-white rounded-none py-6">
                                TUTORIAL
                            </button>
                            {/* <button onClick={() => initGame('Level6', 3)} variant="outline" className="w-full border-yellow-700 text-yellow-400 hover:text-yellow-300 hover:border-yellow-500 rounded-none py-4 text-sm">
                                DEBUG: LIVELLO 6
                            </button> */}
                            <button onClick={() => setShowSettings(!showSettings)} variant="ghost" className="w-full text-neutral-500 hover:text-white">
                                <Settings className="w-4 h-4 mr-2" /> IMPOSTAZIONI
                            </button>
                        </div>
                        
                        {showSettings && (
                            <div className="w-full max-w-xs space-y-4 bg-black/50 p-4 border border-neutral-800 animate-in slide-in-from-top-2">
                                {/*<div className="space-y-2">
                                    <div className="flex justify-between items-center text-xs uppercase text-neutral-400">
                                        <span>Velocità</span>
                                        <span className="text-cyan-400">{settings.moveSpeed}ms</span>
                                    </div>
                                    <div className="flex justify-between text-[10px] text-neutral-600 font-mono">
                                        <span>LENTO</span><span>VELOCE</span>
                                    </div>
                                </div>
                                */}
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center text-xs uppercase text-neutral-400">
                                        <span>Audio</span>
                                        <button 
                                            onClick={() => setSettings(s => ({ ...s, audio: !s.audio }))}
                                            className="text-cyan-400 hover:text-white"
                                        >
                                            {settings.audio ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
            
            {uiState.status === 'menu' && (
                <div className="absolute bottom-8 text-neutral-700 text-[10px] font-mono tracking-widest uppercase">
                    Survive the Code
                </div>
            )}
        </div>
    );
}