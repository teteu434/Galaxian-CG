// ═══════════════════════════════════════════════════════════════
// src/entities/player.js
//
// MUDANÇA:
//   - update() agora verifica SettingsSystem.get('mouseControl')
//     antes de aplicar input de teclado.
//   - Se mouseControl = true, o teclado é completamente ignorado
//     para movimento (game.js cuida disso via Player.setX()).
//   - Isso elimina o conflito onde ambos os modos moviam o player
//     simultaneamente.
// ═══════════════════════════════════════════════════════════════
"use strict";

const Player = (() => {
  let x, y, alive, blinkTimer, blinkAlpha, hit = false;

  function reset() {
    x          = CANVAS_W / 2 - PLAYER_W / 2;
    y          = PLAYER_Y;
    alive      = true;
    hit        = false;
    blinkTimer = 0;
    blinkAlpha = 1;
  }

  function update(dt) {
    // ── Movimento por teclado ──────────────────────────────────
    // GUARD: só processa teclado se mouseControl estiver DESATIVADO.
    // Quando mouse está ativo, game.js chama Player.setX() diretamente
    // com a posição do cursor — processar teclado aqui causaria conflito.
    if (!SettingsSystem.get('mouseControl')) {
      const keyLeft  = SettingsSystem.get('keyLeft')  || [];
      const keyRight = SettingsSystem.get('keyRight') || [];

      if (keyLeft.some(k  => Input.isDown(k))) x = Math.max(0, x - PLAYER_SPEED * dt);
      if (keyRight.some(k => Input.isDown(k))) x = Math.min(CANVAS_W - PLAYER_W, x + PLAYER_SPEED * dt);
    }

    if (!alive) {
      blinkTimer += dt;
      blinkAlpha = Math.abs(Math.sin(blinkTimer * 15)) > 0.5 ? 0 : 1;
    }
    else if (hit) {
      blinkTimer += dt;
      blinkAlpha = Math.abs(Math.sin(blinkTimer * 20)) > 0.5 ? 0 : 1;

      if (blinkTimer >= 1.8) {
        hit = false;
        blinkTimer = 0;
        blinkAlpha = 1;
      }
    }
  }

  function draw() {
    if (( !alive || hit ) && blinkAlpha === 0) return;
    drawSprite(TEX.player, x, y, PLAYER_W, PLAYER_H, [1, 1, 1, 1], alive ? 1 : blinkAlpha);
  }

  function setX(newX) {
    x = Math.max(0, Math.min(CANVAS_W - PLAYER_W, newX));
  }

  function setHit(value) {
    hit = value;
  }

  return {
    reset, update, draw, setX, setHit,
    get x()     { return x; },
    get y()     { return y; },
    get alive() { return alive; },
    get cx()    { return x + PLAYER_W / 2; },
    get cy()    { return y; },
    kill()      { alive = false; },
  };
})();