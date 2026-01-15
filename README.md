# Blitz

Browser-based RTS game built with TypeScript and Phaser 3.

## Links

- **Live Demo**: https://blitz-rts.netlify.app
- **GitHub**: https://github.com/bubilife1202/blitz

## Tech Stack

- **Engine**: Phaser 3.90
- **Language**: TypeScript 5.9
- **Build**: Vite 7.3
- **Pathfinding**: EasyStar.js
- **Architecture**: ECS (Entity-Component-System)

## Features

### Units (Terran)
- SCV (Worker)
- Marine
- Firebat (Splash damage)
- Medic (Healer)
- Vulture
- Siege Tank (Siege mode, splash damage)
- Goliath

### Buildings
- Command Center
- Supply Depot
- Refinery
- Barracks
- Factory
- Engineering Bay
- Armory
- Bunker
- Missile Turret

### Gameplay
- Single-player vs AI
- 3 difficulty levels (Easy / Normal / Hard)
- Fog of war
- Resource gathering (Minerals, Gas)
- Unit production & building construction
- Research/Upgrade system
- Minimap with camera control
- Pause menu

## Controls

| Key | Action |
|-----|--------|
| Left Click | Select unit/building |
| Right Click | Move / Attack / Gather |
| Drag | Box selection |
| A + Click | Attack-move |
| S | Stop |
| H | Hold position |
| ESC | Pause menu |
| Arrow Keys / WASD | Move camera |

## Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build
```

## Project Structure

```
src/
├── client/          # Phaser scenes, renderers, UI, input
│   ├── audio/       # Sound manager
│   ├── input/       # Selection, commands, building placement
│   ├── renderer/    # Unit, building, effects rendering
│   ├── scenes/      # Boot, Menu, Game scenes
│   └── ui/          # HUD, Minimap, Pause menu
├── core/            # ECS, GameState, Systems, Components, AI
│   ├── components/  # Position, Unit, Building, Combat, etc.
│   ├── ecs/         # Entity, Component, System base classes
│   ├── events/      # Combat events bus
│   └── systems/     # Movement, Combat, Production, etc.
├── host/            # LocalHost (single-player server simulation)
└── shared/          # Types, constants, protocol
```

## License

MIT
