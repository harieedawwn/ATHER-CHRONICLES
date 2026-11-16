/**
 * Purpose: Stage identifiers, platform definitions, jump pads, and stage specifications.
 * Exports: StageId, PlatformMotion, StageJumpPad, StagePlatform, StageSpec
 * Depends on: none
 */

export type StageId =
  | 'void_flat'
  | 'torii'
  | 'dojo'
  | 'monolith'
  | 'coliseum'
  | 'hypercube'
  | 'tesseract'
  | 'train';

export interface PlatformMotion {
  axis: 'x' | 'y' | 'orbit';
  ampX: number;
  ampY: number;
  speed: number;
  phase: number;
}

export interface StageJumpPad {
  x: number;
  y: number;
  width: number;
  boostVy: number;
  color: string;
}

export interface StagePlatform {
  x: number;
  y: number;
  width: number;
  thickness?: number;
  isMain: boolean;
  style?: 'stone' | 'wood' | 'holo' | 'obsidian' | 'gold' | 'train' | 'mirror';
  motion?: PlatformMotion;
}

export interface StageSpec {
  id: StageId;
  name: string;
  subtitle: string;
  tag: string;
  skyTop: string;
  skyMid: string;
  skyBottom: string;
  accentColor: string;
  platforms: StagePlatform[];
  spawnX?: [number, number];
  gravityMult?: number;
  wrapHorizontal?: boolean;
  wrapEdgeX?: number;
  windHazard?: boolean;
  jumpPads?: StageJumpPad[];
  blastLeft: number;
  blastRight: number;
  blastTop: number;
  blastBottom: number;
  wallLeft: number; // used in HP mode
  wallRight: number; // used in HP mode
}
