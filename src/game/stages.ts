import { StageId, StagePlatform, StageSpec } from './types';

export interface ResolvedPlatform {
  x: number;
  y: number;
  vx: number;
  vy: number;
  left: number;
  right: number;
  width: number;
  thickness: number;
  isMain: boolean;
  style: NonNullable<StagePlatform['style']>;
}

/**
 * Computes the exact frame-accurate world coordinates, bounds, and delta velocity
 * of any static or animated platform at `tick`, shared by both physics & rendering.
 */
export function resolvePlatformAtTick(plat: StagePlatform, tick: number): ResolvedPlatform {
  let x = plat.x;
  let y = plat.y;
  let prevX = plat.x;
  let prevY = plat.y;

  if (plat.motion) {
    const { axis, ampX, ampY, speed, phase } = plat.motion;
    const tNow = tick * speed + phase;
    const tPrev = (tick - 1) * speed + phase;
    if (axis === 'x') {
      x += Math.sin(tNow) * ampX;
      prevX += Math.sin(tPrev) * ampX;
    } else if (axis === 'y') {
      y += Math.sin(tNow) * ampY;
      prevY += Math.sin(tPrev) * ampY;
    } else if (axis === 'orbit') {
      x += Math.cos(tNow) * ampX;
      y += Math.sin(tNow) * ampY;
      prevX += Math.cos(tPrev) * ampX;
      prevY += Math.sin(tPrev) * ampY;
    }
  }

  const width = plat.width;
  const thickness = plat.thickness ?? (plat.isMain ? 26 : 8);

  return {
    x,
    y,
    vx: x - prevX,
    vy: y - prevY,
    left: x - width * 0.5,
    right: x + width * 0.5,
    width,
    thickness,
    isMain: plat.isMain,
    style: plat.style ?? (plat.isMain ? 'stone' : 'wood'),
  };
}

export const STAGES: Record<StageId, StageSpec> = {
  // 1. PURE FLAT / EMPTY NEUTRAL STAGE (Final Destination style)
  void_flat: {
    id: 'void_flat',
    name: 'Horizon Zero',
    subtitle: 'Infinite mirror water plane with zero platform obstructions',
    tag: 'Flat Neutral',
    skyTop: '#050711',
    skyMid: '#0d152a',
    skyBottom: '#1c2b4b',
    accentColor: '#38bdf8',
    spawnX: [-115, 115],
    platforms: [
      {
        x: 0,
        y: 124,
        width: 520,
        thickness: 24,
        isMain: true,
        style: 'mirror',
      },
    ],
    blastLeft: -560,
    blastRight: 560,
    blastTop: -360,
    blastBottom: 340,
    wallLeft: -260,
    wallRight: 260,
  },

  // 2. CLASSIC BALANCED SHRINE (Battlefield style)
  torii: {
    id: 'torii',
    name: 'Crimson Torii',
    subtitle: 'Blood-moon ridge with twin shrine rafters & falling sakura',
    tag: 'Balanced',
    skyTop: '#0b0916',
    skyMid: '#21132e',
    skyBottom: '#4a1834',
    accentColor: '#f43f5e',
    spawnX: [-115, 115],
    platforms: [
      { x: 0, y: 122, width: 520, thickness: 26, isMain: true, style: 'stone' },
      { x: -150, y: 36, width: 128, thickness: 8, isMain: false, style: 'wood' },
      { x: 150, y: 36, width: 128, thickness: 8, isMain: false, style: 'wood' },
    ],
    blastLeft: -560,
    blastRight: 560,
    blastTop: -360,
    blastBottom: 340,
    wallLeft: -260,
    wallRight: 260,
  },

  // 3. ANIMATED MOVING ELEVATORS (Sky Dojo)
  dojo: {
    id: 'dojo',
    name: 'Cloud Pagoda',
    subtitle: 'High pagoda loft with twin counter-moving elevator platforms',
    tag: 'Moving Platforms',
    skyTop: '#070f1d',
    skyMid: '#12243c',
    skyBottom: '#23405c',
    accentColor: '#f59e0b',
    spawnX: [-125, 125],
    platforms: [
      { x: 0, y: 124, width: 550, thickness: 26, isMain: true, style: 'wood' },
      { x: 0, y: -38, width: 140, thickness: 8, isMain: false, style: 'gold' },
      {
        x: -185,
        y: 34,
        width: 116,
        thickness: 8,
        isMain: false,
        style: 'wood',
        motion: { axis: 'y', ampX: 0, ampY: 36, speed: 0.028, phase: 0 },
      },
      {
        x: 185,
        y: 34,
        width: 116,
        thickness: 8,
        isMain: false,
        style: 'wood',
        motion: { axis: 'y', ampX: 0, ampY: 36, speed: 0.028, phase: Math.PI },
      },
    ],
    blastLeft: -580,
    blastRight: 580,
    blastTop: -370,
    blastBottom: 340,
    wallLeft: -275,
    wallRight: 275,
  },

  // 4. TRICKY SPLIT ISLANDS + UPDRAFT GEYSER JUMP PADS
  monolith: {
    id: 'monolith',
    name: 'Twin Abyss Rift',
    subtitle: 'Split twin islands over a lethal chasm with updraft jump geysers',
    tag: 'Split Gap · Updraft',
    skyTop: '#050b12',
    skyMid: '#0d2229',
    skyBottom: '#123e3c',
    accentColor: '#10b981',
    spawnX: [-165, 165],
    platforms: [
      { x: -168, y: 124, width: 225, thickness: 28, isMain: true, style: 'obsidian' },
      { x: 168, y: 124, width: 225, thickness: 28, isMain: true, style: 'obsidian' },
      {
        x: 0,
        y: 52,
        width: 118,
        thickness: 8,
        isMain: false,
        style: 'obsidian',
        motion: { axis: 'x', ampX: 52, ampY: 0, speed: 0.026, phase: 0 },
      },
      { x: -168, y: -12, width: 110, thickness: 8, isMain: false, style: 'obsidian' },
      { x: 168, y: -12, width: 110, thickness: 8, isMain: false, style: 'obsidian' },
    ],
    jumpPads: [
      { x: -74, y: 124, width: 32, boostVy: -12.6, color: '#10b981' },
      { x: 74, y: 124, width: 32, boostVy: -12.6, color: '#10b981' },
    ],
    blastLeft: -560,
    blastRight: 560,
    blastTop: -370,
    blastBottom: 340,
    wallLeft: -280,
    wallRight: 280,
  },

  // 5. COLOSSAL WIDE WARGROUNDS
  coliseum: {
    id: 'coliseum',
    name: 'Titan Coliseum',
    subtitle: 'Massive 760px grand arena beneath a shattered colossus blade',
    tag: 'Colossal Wide',
    skyTop: '#120908',
    skyMid: '#2b130e',
    skyBottom: '#4d2214',
    accentColor: '#f97316',
    spawnX: [-175, 175],
    platforms: [
      { x: 0, y: 128, width: 760, thickness: 30, isMain: true, style: 'stone' },
      { x: -245, y: 52, width: 135, thickness: 8, isMain: false, style: 'gold' },
      { x: 245, y: 52, width: 135, thickness: 8, isMain: false, style: 'gold' },
      { x: -95, y: -16, width: 120, thickness: 8, isMain: false, style: 'gold' },
      { x: 95, y: -16, width: 120, thickness: 8, isMain: false, style: 'gold' },
    ],
    blastLeft: -720,
    blastRight: 720,
    blastTop: -390,
    blastBottom: 350,
    wallLeft: -380,
    wallRight: 380,
  },

  // 6. 3D PERSPECTIVE WIREFRAME & ROTATING 4D HYPERCUBE
  hypercube: {
    id: 'hypercube',
    name: 'Cyber-Grid 3D',
    subtitle: '3D perspective matrix with rotating 4D Tesseract & holo-decks',
    tag: '3D Matrix',
    skyTop: '#050414',
    skyMid: '#11092b',
    skyBottom: '#220b3b',
    accentColor: '#06b6d4',
    spawnX: [-115, 115],
    platforms: [
      { x: 0, y: 124, width: 500, thickness: 22, isMain: true, style: 'holo' },
      {
        x: -145,
        y: 38,
        width: 118,
        thickness: 7,
        isMain: false,
        style: 'holo',
        motion: { axis: 'x', ampX: 28, ampY: 0, speed: 0.03, phase: 0 },
      },
      {
        x: 145,
        y: 38,
        width: 118,
        thickness: 7,
        isMain: false,
        style: 'holo',
        motion: { axis: 'x', ampX: 28, ampY: 0, speed: 0.03, phase: Math.PI },
      },
      {
        x: 0,
        y: -28,
        width: 130,
        thickness: 7,
        isMain: false,
        style: 'holo',
        motion: { axis: 'y', ampX: 0, ampY: 14, speed: 0.04, phase: 1.2 },
      },
    ],
    blastLeft: -560,
    blastRight: 560,
    blastTop: -370,
    blastBottom: 340,
    wallLeft: -250,
    wallRight: 250,
  },

  // 7. STRANGE SPATIAL WARP LOOP + LOW GRAVITY ANOMALY
  tesseract: {
    id: 'tesseract',
    name: 'Möbius Continuum',
    subtitle: 'Dimensional edge wrap-around, 0.78× low gravity & orbiting rings',
    tag: 'Spatial Loop · Low-G',
    skyTop: '#060512',
    skyMid: '#181136',
    skyBottom: '#2e1652',
    accentColor: '#c084fc',
    spawnX: [-110, 110],
    gravityMult: 0.78,
    wrapHorizontal: true,
    wrapEdgeX: 300,
    platforms: [
      { x: 0, y: 126, width: 450, thickness: 24, isMain: true, style: 'gold' },
      {
        x: -135,
        y: 26,
        width: 112,
        thickness: 8,
        isMain: false,
        style: 'gold',
        motion: { axis: 'orbit', ampX: 22, ampY: 18, speed: 0.025, phase: 0 },
      },
      {
        x: 135,
        y: 26,
        width: 112,
        thickness: 8,
        isMain: false,
        style: 'gold',
        motion: { axis: 'orbit', ampX: -22, ampY: 18, speed: 0.025, phase: Math.PI },
      },
    ],
    jumpPads: [{ x: 0, y: 126, width: 42, boostVy: -12.0, color: '#e879f9' }],
    blastLeft: -560,
    blastRight: 560,
    blastTop: -390,
    blastBottom: 340,
    wallLeft: -290,
    wallRight: 290,
  },

  // 8. HIGH-SPEED RUNAWAY MAGLEV TRAIN + WIND SLIPSTREAM HAZARD
  train: {
    id: 'train',
    name: 'Phantom Maglev',
    subtitle: 'Coupled bullet-train roofs with periodic high-speed slipstream gusts',
    tag: 'Speed Train · Wind',
    skyTop: '#050814',
    skyMid: '#0e192d',
    skyBottom: '#1c2536',
    accentColor: '#facc15',
    spawnX: [-140, 140],
    windHazard: true,
    platforms: [
      { x: -145, y: 122, width: 250, thickness: 28, isMain: true, style: 'train' },
      { x: 145, y: 122, width: 250, thickness: 28, isMain: true, style: 'train' },
      { x: 0, y: 36, width: 165, thickness: 8, isMain: false, style: 'train' },
    ],
    blastLeft: -580,
    blastRight: 580,
    blastTop: -360,
    blastBottom: 340,
    wallLeft: -270,
    wallRight: 270,
  },
};

export const STAGE_LIST: StageSpec[] = [
  STAGES.void_flat,
  STAGES.torii,
  STAGES.dojo,
  STAGES.monolith,
  STAGES.coliseum,
  STAGES.hypercube,
  STAGES.tesseract,
  STAGES.train,
];
