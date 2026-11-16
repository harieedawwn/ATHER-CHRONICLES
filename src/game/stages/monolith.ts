/**
 * Purpose: Stage specification for Twin Abyss Rift (monolith), split crystal fortresses with updraft geysers.
 * Exports: MONOLITH_STAGE
 * Depends on: ../types
 */

import { StageSpec } from '../types';

export const MONOLITH_STAGE: StageSpec = {
  id: 'monolith',
  name: 'Twin Abyss Rift',
  subtitle: 'Split crystal fortresses over a lethal chasm with updraft geysers',
  tag: 'Split Chasm · Updrafts',
  skyTop: '#040910',
  skyMid: '#0a1e24',
  skyBottom: '#103836',
  accentColor: '#10b981',
  spawnX: [-185, 185],
  platforms: [
    { x: -190, y: 124, width: 250, thickness: 170, isMain: true, style: 'obsidian' },
    { x: 190, y: 124, width: 250, thickness: 170, isMain: true, style: 'obsidian' },
    {
      x: 0,
      y: 54,
      width: 110,
      thickness: 12,
      isMain: false,
      style: 'obsidian',
      motion: { axis: 'x', ampX: 36, ampY: 0, speed: 0.025, phase: 0 },
    },
    { x: -205, y: -14, width: 108, thickness: 12, isMain: false, style: 'obsidian' },
    { x: 205, y: -14, width: 108, thickness: 12, isMain: false, style: 'obsidian' },
  ],
  jumpPads: [
    { x: -82, y: 124, width: 34, boostVy: -12.8, color: '#10b981' },
    { x: 82, y: 124, width: 34, boostVy: -12.8, color: '#10b981' },
  ],
  blastLeft: -620,
  blastRight: 620,
  blastTop: -400,
  blastBottom: 340,
  wallLeft: -315,
  wallRight: 315,
};
