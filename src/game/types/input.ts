/**
 * Purpose: Per-frame controller input state and buffered action queue entries.
 * Exports: InputState, BufferedInput
 * Depends on: none
 */

export interface InputState {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  jump: boolean;
  shortHop: boolean;
  light: boolean;
  strong: boolean;
  special: boolean;
  dash: boolean;
  taunt: boolean;
  ultimate: boolean;
}

export interface BufferedInput {
  type: 'jump' | 'shortHop' | 'light' | 'strong' | 'special' | 'dash' | 'taunt' | 'ultimate';
  dirX: -1 | 0 | 1;
  dirY: -1 | 0 | 1;
  ttl: number;
}
