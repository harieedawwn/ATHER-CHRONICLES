/**
 * Purpose: Core physics, movement, platform collision, and fixed-timestep constants.
 * Exports: FIXED_DT, GRAVITY_SCALE_DEFAULT, GROUND_FRICTION_IDLE, AIR_DRAG, FIGHTER_HALF_WIDTH, FIGHTER_HEIGHT, JUMP_SQUAT_FRAMES, AIR_DODGE_FRAMES, PARRY_ACTIVE_FRAMES, PARRY_TOTAL_FRAMES
 * Depends on: none
 */

export const FIXED_FPS = 60;
export const FIXED_DT = 1000 / FIXED_FPS;
export const MAX_ACCUMULATOR_MS = 100;

export const FIGHTER_HALF_WIDTH = 15;
export const FIGHTER_HEIGHT = 46;
export const FIGHTER_PUSHBOX_DIST = 24;
export const FIGHTER_PUSH_FORCE = 1.3;

export const GROUND_FRICTION_IDLE = 0.76;
export const GROUND_FRICTION_ATTACK = 0.84;
export const GROUND_FRICTION_HITSTUN = 0.9;
export const AIR_DRAG_DEFAULT = 0.96;
export const AIR_DRAG_HITSTUN = 0.985;

export const JUMP_SQUAT_FRAMES = 4;
export const DROP_THROUGH_FRAMES = 11;
export const DOUBLE_TAP_DASH_WINDOW = 13;
export const INPUT_BUFFER_TTL = 7;

export const AIR_DODGE_FRAMES = 22;
export const AIR_DODGE_INVULN_FRAMES = 15;
export const AIR_DODGE_SPEED_MULT = 1.68;

export const PARRY_ACTIVE_START = 2;
export const PARRY_ACTIVE_END = 14;
export const PARRY_TOTAL_FRAMES = 28;
export const PARRY_COOLDOWN_FRAMES = 26;
