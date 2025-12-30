# QueRy — QR Phaser Game

QueRy è un gioco web sperimentale sviluppato con **Phaser** e integrato in un’app moderna basata su **Vite + React**.  
Il progetto è pensato per essere utilizzato direttamente via browser (desktop e mobile) e distribuito online tramite GitHub Pages.

🔗 **Live demo**  
https://aboutdani.github.io/query-game/

---

## 🎮 Cos’è QueRy

QueRy è un gioco a livelli che combina gameplay in stile arcade con meccaniche logiche e sequenziali.  
Il motore di gioco è **Phaser 3**, mentre **React** gestisce interfaccia, menu e navigazione.

Il progetto nasce come esperienza QR / interattiva, ma può essere esteso facilmente con nuovi livelli o sistemi di gioco.

---

## 🧠 Com’è fatto il progetto (in breve)

⚠️ **Non è un “Phaser puro”**.  
È un progetto **Vite + React**, all’interno del quale il gioco Phaser vive in un componente React dedicato.

### Stack principale
- **Vite** – bundler e dev server
- **React** – UI e routing
- **Phaser 3** – motore di gioco
- **Tailwind CSS** – styling utility-first

---

## 📁 Struttura del progetto

```text
src/
├─ components/
│ └─ game/
│ ├─ PhaserGame.jsx # Wrapper React che istanzia Phaser
│ └─ scenes/
│ ├─ Level0.jsx
│ ├─ Level1.jsx
│ ├─ ...
│ └─ Level9.jsx # Scene / livelli Phaser
│
├─ pages/
│ ├─ index.jsx # Routing React
│ ├─ Game.jsx
│ └─ Home.jsx
│
├─ App.jsx
└─ main.jsx

---

### File chiave
- **`src/components/game/PhaserGame.jsx`**  
  Wrapper React che crea e gestisce l’istanza Phaser, lo stato del gioco e la comunicazione con le scene.
- **`src/components/game/scenes/Level*.jsx`**  
  Scene Phaser (`Phaser.Scene`) che contengono la logica di ogni livello.
- **`src/pages/*`**  
  Gestione del routing React (menu, gioco, schermate).

---

## ▶️ Avvio in locale (sviluppo)

### Prerequisiti
- Node.js (versione LTS consigliata)

### Avvio
```bash
npm install
npm run dev

---

🌐 Deploy (GitHub Pages)

Il progetto è configurato per il deploy automatico su GitHub Pages tramite GitHub Actions.

Ogni push sul branch main:

esegue la build con Vite

pubblica automaticamente la versione aggiornata online