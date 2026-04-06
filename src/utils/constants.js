// ═══════════════════════════════════════════════════════════════
// src/utils/constants.js
// Constantes globais do jogo.
// ═══════════════════════════════════════════════════════════════
"use strict";

// ── Canvas ────────────────────────────────────────────────────
const CANVAS_W = 480;
const CANVAS_H = 640;

// ── Jogador ───────────────────────────────────────────────────
const PLAYER_SPEED = 280;
const PLAYER_W     = 40;
const PLAYER_H     = 36;
const PLAYER_Y     = CANVAS_H - 70;

// ── Tiro do jogador ───────────────────────────────────────────
const BULLET_SPEED = 520;
const BULLET_W     = 6;
const BULLET_H     = 18;

// ── Inimigos ──────────────────────────────────────────────────
const ENEMY_COLS       = 8;
const ENEMY_ROWS       = 4;
const ENEMY_W          = 38;
const ENEMY_H          = 28;
const ENEMY_PAD_X      = 14;
const ENEMY_PAD_Y      = 12;
const ENEMY_START_Y    = 60;
const ENEMY_SPEED_INIT = 60;
const ENEMY_SPEED_INC  = 6;
const ENEMY_DROP       = 18;

// ── Tiros dos inimigos ────────────────────────────────────────
const EBULLET_SPEED    = 240;
const EBULLET_W        = 5;
const EBULLET_H        = 16;
const EBULLET_INTERVAL = 1.4;
const EBULLET_MAX      = 4;

// ── Estados do jogo ───────────────────────────────────────────
const STATE_MENU      = 'menu';
const STATE_TUTORIAL  = 'tutorial';
const STATE_RUNNING   = 'running';
const STATE_PAUSED    = 'paused';
const STATE_GAMEOVER  = 'gameover';
const STATE_WIN       = 'win';
const STATE_CONFIRM   = 'confirm';

// ── Chaves para localStorage ───────────────────────────────────
const TUTORIAL_COMPLETED_KEY = 'galaxian_tutorial_completed';
const SETTINGS_KEY = 'galaxian_settings';

// ── Configurações padrão ───────────────────────────────────────
const DEFAULT_SETTINGS = {
  // Controles
  keyLeft: ['ArrowLeft', 'KeyA'],
  keyRight: ['ArrowRight', 'KeyD'],
  keyShoot: ['Space'],
  keyPause: ['KeyP', 'Escape'],
  keyRestart: ['KeyR'],
  mouseControl: true,
  
  // Áudio
  masterVolume: 0.7,
  musicVolume: 0.5,
  sfxVolume: 0.8,
  musicEnabled: true,
  sfxEnabled: true
};