// ═══════════════════════════════════════════════════════════════
// src/entities/player.js
// ⚠️  PONTO CRÍTICO — remoção dos hardcodes de teclas:
//   update() agora lê as teclas via SettingsSystem.get(),
//   eliminando a inconsistência com NEW_SETTINGS.
// ═══════════════════════════════════════════════════════════════
"use strict";

const Player = (() => {
  let x, y, alive, blinkTimer, blinkAlpha;

  function reset() {
    x          = CANVAS_W / 2 - PLAYER_W / 2;
    y          = PLAYER_Y;
    alive      = true;
    blinkTimer = 0;
    blinkAlpha = 1;
  }

  function update(dt) {
    // Lê teclas do SettingsSystem — nunca hardcoda 'ArrowLeft' etc.
    const keyLeft  = SettingsSystem.get('keyLeft')  || [];
    const keyRight = SettingsSystem.get('keyRight') || [];

    if (keyLeft.some(k  => Input.isDown(k))) x = Math.max(0, x - PLAYER_SPEED * dt);
    if (keyRight.some(k => Input.isDown(k))) x = Math.min(CANVAS_W - PLAYER_W, x + PLAYER_SPEED * dt);

    if (!alive) {
      blinkTimer += dt;
      blinkAlpha = Math.abs(Math.sin(blinkTimer * 15)) > 0.5 ? 0 : 1;
    }
  }

  function draw() {
    if (!alive && blinkAlpha === 0) return;
    drawSprite(TEX.player, x, y, PLAYER_W, PLAYER_H, [1, 1, 1, 1], alive ? 1 : blinkAlpha);
  }

  function setX(newX) {
    x = Math.max(0, Math.min(CANVAS_W - PLAYER_W, newX));
  }

  return {
    reset, update, draw, setX,
    get x()     { return x; },
    get y()     { return y; },
    get alive() { return alive; },
    get cx()    { return x + PLAYER_W / 2; },
    get cy()    { return y; },
    kill()      { alive = false; },
  };
})();