/**
 * Purpose: Stage specification for Phantom Maglev (train), a 920px 3-car high-speed bullet train convoy with wind gusts.
 * Exports: TRAIN_STAGE
 * Depends on: ../types
 */

import { StageSpec } from '../types';

export const TRAIN_STAGE: StageSpec = {
  id: 'train',
  name: 'Phantom Maglev',
  subtitle: '920px 3-car bullet train convoy racing through a neon megacity with wind gusts',
  tag: '3-Car Convoy · 920px',
  skyTop: '#040712',
  skyMid: '#0b1629',
  skyBottom: '#182438',
  accentColor: '#facc15',
  spawnX: [-160, 160],
  windHazard: true,
  platforms: [
    // Rear Artillery Car, Center Plasma Reactor Car, and Front Locomotive!
    { x: -305, y: 124, width: 250, thickness: 64, isMain: true, style: 'train' },
    { x: 0, y: 124, width: 280, thickness: 64, isMain: true, style: 'train' },
    { x: 305, y: 124, width: 250, thickness: 64, isMain: true, style: 'train' },
    // Overhead Catenary Spoiler Decks & Central Pantograph Deck
    { x: -155, y: 42, width: 118, thickness: 11, isMain: false, style: 'train' },
    { x: 155, y: 42, width: 118, thickness: 11, isMain: false, style: 'train' },
    { x: 0, y: -22, width: 132, thickness: 11, isMain: false, style: 'train' },
  ],
  blastLeft: -820,
  blastRight: 820,
  blastTop: -400,
  blastBottom: 350,
  wallLeft: -430,
  wallRight: 430,
};
