import React from 'react';
import PhaserGame from '../components/game/PhaserGame';

export default function Game() {
  return (
    <div className="w-full h-full flex flex-col items-center">
      <PhaserGame />
    </div>
  );
}