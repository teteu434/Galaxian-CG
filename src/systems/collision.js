// ═══════════════════════════════════════════════════════════════
// src/systems/collision.js
// Sistema de detecção e resolução de colisões AABB.
//
// Verifica três pares por frame:
//   1. Tiro do jogador  ↔  inimigos         → mata inimigo, remove tiro
//   2. Tiros inimigos   ↔  jogador          → mata jogador → game over
//   3. Inimigos (corpo) ↔  jogador          → mata jogador → game over
//   4. Inimigos chegaram ao chão            → mata jogador → game over
//
// game over é atrasado 600ms para exibir o efeito de piscar.
//
// Dependências:
//   GameState    (core/state.js)
//   EnemySystem  (systems/enemySystem.js)
//   Bullet       (entities/bullet.js)
//   Player       (entities/player.js)
//   aabbOverlap  (utils/math.js)
//   STATE_RUNNING, STATE_GAMEOVER, STATE_WIN (constants.js)
//   BULLET_W/H, EBULLET_W/H, ENEMY_W/H, PLAYER_W/H, PLAYER_Y (constants.js)
// Exporta (global): CollisionSystem
// ═══════════════════════════════════════════════════════════════
"use strict";

const CollisionSystem = (() => {

  function check() {
    // Colisões só ocorrem durante o jogo ativo
    if (!GameState.is(STATE_RUNNING)) return;

    const alive = EnemySystem.aliveList();

    // ── 1. Tiro do jogador ↔ inimigos ────────────────────────
    if (Bullet.active) {
      for (const e of alive) {
        const ep = EnemySystem.absPos(e);
        if (aabbOverlap(
          Bullet.x, Bullet.y, BULLET_W, BULLET_H,
          ep.x,     ep.y,     ENEMY_W,  ENEMY_H
        )) {
          Bullet.deactivate();   // remove o tiro
          EnemySystem.killEnemy(e); // destrói o inimigo
          break; // 1 tiro = 1 inimigo; para de verificar
        }
      }
    }

    // ── 2. Tiros inimigos ↔ jogador ──────────────────────────
    if (Player.alive) {
      for (const b of EnemySystem.eBullets) {
        if (!b.active) continue;
        if (aabbOverlap(
          b.x,      b.y,      EBULLET_W, EBULLET_H,
          Player.x, Player.y, PLAYER_W,  PLAYER_H
        )) {
          b.active = false;
          Player.kill();
          // Aguarda 600ms (efeito de piscar) antes de exibir game over
          setTimeout(() => GameState.set(STATE_GAMEOVER), 600);
          return; // encerra todas as verificações do frame
        }
      }

      // ── 3. Inimigos (corpo) ↔ jogador ─────────────────────
      for (const e of alive) {
        const ep = EnemySystem.absPos(e);
        if (aabbOverlap(
          Player.x, Player.y, PLAYER_W, PLAYER_H,
          ep.x,     ep.y,     ENEMY_W,  ENEMY_H
        )) {
          Player.kill();
          setTimeout(() => GameState.set(STATE_GAMEOVER), 600);
          return;
        }
      }

      // ── 4. Inimigos chegaram ao chão ──────────────────────
      for (const e of alive) {
        const ep = EnemySystem.absPos(e);
        if (ep.y + ENEMY_H >= PLAYER_Y) {
          Player.kill();
          setTimeout(() => GameState.set(STATE_GAMEOVER), 600);
          return;
        }
      }
    }

    // ── 5. Condição de vitória ────────────────────────────────
    if (alive.length === 0) {
      GameState.set(STATE_WIN);
    }
  }

  return { check };
})();