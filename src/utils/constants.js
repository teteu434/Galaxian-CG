// ═══════════════════════════════════════════════════════════════
// src/utils/constants.js
// Constantes globais do jogo.
// Centralizar aqui evita "números mágicos" espalhados pelo código
// e facilita ajustes de balanceamento sem caça ao grep.
//
// Dependências: nenhuma
// Exporta (global): CANVAS_W, CANVAS_H, PLAYER_*, BULLET_*,
//                   ENEMY_*, EBULLET_*, STATE_*
// ═══════════════════════════════════════════════════════════════
"use strict";

// ── Canvas ────────────────────────────────────────────────────
const CANVAS_W = 480;
const CANVAS_H = 640;

// ── Jogador ───────────────────────────────────────────────────
const PLAYER_SPEED = 280;          // px/s
const PLAYER_W     = 40;           // largura do sprite em px
const PLAYER_H     = 36;           // altura do sprite em px
const PLAYER_Y     = CANVAS_H - 70; // posição Y fixa (parte inferior)

// ── Tiro do jogador ───────────────────────────────────────────
const BULLET_SPEED = 520;          // px/s (sobe)
const BULLET_W     = 6;
const BULLET_H     = 18;

// ── Inimigos ──────────────────────────────────────────────────
const ENEMY_COLS       = 8;        // colunas na formação
const ENEMY_ROWS       = 4;        // linhas na formação
const ENEMY_W          = 38;
const ENEMY_H          = 28;
const ENEMY_PAD_X      = 14;       // espaçamento horizontal entre inimigos
const ENEMY_PAD_Y      = 12;       // espaçamento vertical
const ENEMY_START_Y    = 60;       // Y do topo da formação
const ENEMY_SPEED_INIT = 60;       // px/s lateral inicial
const ENEMY_SPEED_INC  = 6;        // px/s acrescentados a cada morte
const ENEMY_DROP       = 18;       // px que o bloco desce ao bater na borda

// ── Tiros dos inimigos ────────────────────────────────────────
const EBULLET_SPEED    = 240;      // px/s (desce)
const EBULLET_W        = 5;
const EBULLET_H        = 16;
const EBULLET_INTERVAL = 1.4;      // segundos entre disparos
const EBULLET_MAX      = 4;        // máximo de tiros inimigos simultâneos

// ── Estados do jogo ───────────────────────────────────────────
const STATE_RUNNING  = 'running';
const STATE_PAUSED   = 'paused';
const STATE_GAMEOVER = 'gameover';
const STATE_WIN      = 'win';
const STATE_CONFIRM  = 'confirm';  // aguardando confirmação de reinício