// ═══════════════════════════════════════════════════════════════
// src/utils/constants.js
// ═══════════════════════════════════════════════════════════════
"use strict";

const CANVAS_W = 480;
const CANVAS_H = 640;
const PLAYER_SPEED = 280;
const PLAYER_W     = 40;
const PLAYER_H     = 36;
const PLAYER_Y     = CANVAS_H - 70;
const BULLET_SPEED = 520;
const BULLET_W     = 6;
const BULLET_H     = 18;
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
const EBULLET_SPEED    = 240;
const EBULLET_W        = 5;
const EBULLET_H        = 16;
const EBULLET_INTERVAL = 1.4;
const EBULLET_MAX      = 4;

const STATE_MENU      = 'menu';
const STATE_TUTORIAL  = 'tutorial';
const STATE_RUNNING   = 'running';
const STATE_PAUSED    = 'paused';
const STATE_GAMEOVER  = 'gameover';
const STATE_WIN       = 'win';
const STATE_CONFIRM   = 'confirm';

const TUTORIAL_COMPLETED_KEY = 'galaxian_tutorial_completed';
const SETTINGS_KEY           = 'galaxian_settings';

// ── DEFAULT_SETTINGS: somente leitura, nunca modificado ────────
const DEFAULT_SETTINGS = Object.freeze({
  keyLeft:       ['ArrowLeft', 'KeyA'],
  keyRight:      ['ArrowRight', 'KeyD'],
  keyShoot:      ['Space'],
  keyPause:      ['KeyP', 'Escape'],
  keyRestart:    ['KeyR'],
  keyboardControl: true,
  mouseControl:  false,
  masterVolume:  0.7,
  musicVolume:   0.5,
  sfxVolume:     0.8,
  musicEnabled:  true,
  sfxEnabled:    true,
});

// ── Utilitário: deep copy segura das settings ──────────────────
// Copia arrays e primitivos sem referências compartilhadas.
function cloneSettings(src) {
  const out = {};
  for (const key of Object.keys(src)) {
    out[key] = Array.isArray(src[key]) ? [...src[key]] : src[key];
  }
  return out;
}

// ── NEW_SETTINGS: estado mutável em runtime ────────────────────
// Inicializado como cópia de DEFAULT_SETTINGS.
// Toda leitura de input DEVE passar por SettingsSystem.get().
const NEW_SETTINGS = cloneSettings(DEFAULT_SETTINGS);