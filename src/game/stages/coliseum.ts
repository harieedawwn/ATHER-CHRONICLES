/**
 * Purpose: Stage specification for Titan Coliseum (coliseum), a colossal 1080px ultra-wide amphitheater.
 * Exports: COLISEUM_STAGE
 * Depends on: ../types
 */

import { StageSpec } from '../types';

export const COLISEUM_STAGE: StageSpec = {
  id: 'coliseum',
  name: 'Titan Coliseum',
  subtitle: 'Colossal 1080px grand amphitheater with bastion towers & jump catapults',
  tag: 'Ultra-Wide · 1080px',
  skyTop: '#110706',
  skyMid: '#28110c',
  skyBottom: '#4a1f12',
  accentColor: '#f97316',
  spawnX: [-210, 210],
  platforms: [
    { x: 0, y: 130, width: 1080, thickness: 175, isMain: true, style: 'stone' },
    { x: -370, y: 46, width: 136, thickness: 13, isMain: false, style: 'stone' },
    { x: 370, y: 46, width: 136, thickness: 13, isMain: false, style: 'stone' },
    { x: -165, y: 56, width: 120, thickness: 12, isMain: false, style: 'gold' },
    { x: 165, y: 56, width: 120, thickness: 12, isMain: false, style: 'gold' },
    { x: 0, y: -18, width: 146, thickness: 12, isMain: false, style: 'gold' },
  ],
  jumpPads: [
    { x: -475, y: 130, width: 38, boostVy: -13.2, color: '#f97316' },
    { x: 475, y: 130, width: 38, boostVy: -13.2, color: '#f97316' },
  ],
  blastLeft: -920,
  blastRight: 920,
  blastTop: -430,
  blastBottom: 360,
  wallLeft: -540,
  wallRight: 540,
};
