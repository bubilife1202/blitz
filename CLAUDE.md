# Project Guidelines

## Deployment

- **Live URL:** https://blitz-rts.netlify.app
- **GitHub:** https://github.com/bubilife1202/blitz
- Push to `main` branch triggers automatic Netlify deployment

## Runtime

- **DO NOT use Bun.** Use Node.js only.
  - Bun has critical bugs on Windows (Segmentation fault crashes)
  - All scripts work identically with `npm run` commands
  - Dev server: `npm run dev`
  - Build: `npm run build`

## Entity Naming (Generic, non-copyrighted)

| Type | Enum Value | Description |
|------|------------|-------------|
| **Units** | | |
| Worker | `UnitType.ENGINEER` | Resource gatherer, builder |
| Infantry | `UnitType.TROOPER` | Basic ranged unit |
| Flame | `UnitType.PYRO` | Splash damage infantry |
| Healer | `UnitType.MEDIC` | Heals infantry |
| Scout | `UnitType.SPEEDER` | Fast vehicle |
| Siege | `UnitType.ARTILLERY` | Long-range bombardment mode |
| Mech | `UnitType.WALKER` | Anti-air vehicle |
| **Buildings** | | |
| Main Base | `BuildingType.HQ` | Produces workers |
| Supply | `BuildingType.DEPOT` | Increases supply cap |
| Gas | `BuildingType.REFINERY` | Harvests gas |
| Infantry | `BuildingType.BARRACKS` | Produces infantry |
| Vehicle | `BuildingType.FACTORY` | Produces vehicles |
| Research | `BuildingType.TECH_LAB` | Infantry upgrades |
| Upgrades | `BuildingType.ARMORY` | Vehicle upgrades |
| Defense | `BuildingType.BUNKER` | Garrison infantry |
| Anti-air | `BuildingType.TURRET` | Defensive structure |
