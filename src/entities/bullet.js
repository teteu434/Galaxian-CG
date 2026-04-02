// ═══════════════════════════════════════════════════════════════
// src/entities/bullet.js
// Tiro do jogador — máximo de 1 ativo simultaneamente (regra clássica).
//
// Um novo tiro só pode ser disparado quando:
//   - O anterior sair da tela (y + h < 0), OU
//   - O anterior colidir com um inimigo (deactivate() chamado por collision.js)
//
// Dependências:
//   drawSprite  (render/renderer.js)
//   TEX         (render/textureLoader.js)
//   BULLET_SPEED, BULLET_W, BULLET_H (constants.js)
// Exporta (global): Bullet
// ═══════════════════════════════════════════════════════════════
"use strict";

const Bullet = (() => {
  let x, y, active;

  function reset() {
    active = false;
  }

  /**
   * Dispara o tiro a partir do centro da nave.
   * @param {number} cx      Centro X da nave (px)
   * @param {number} originY Topo da nave — ponto de origem do tiro (px)
   */
  function fire(cx, originY) {
    if (active) return; // ignora se já há um tiro ativo
    x      = cx - BULLET_W / 2; // centraliza o tiro horizontalmente
    y      = originY - BULLET_H; // nasce acima da nave
    active = true;
  }

  function update(dt) {
    if (!active) return;
    y -= BULLET_SPEED * dt; // sobe na tela (Y diminui)
    if (y + BULLET_H < 0) active = false; // saiu pelo topo
  }

  function draw() {
    if (!active) return;
    drawSprite(TEX.bullet, x, y, BULLET_W, BULLET_H);
  }

  return {
    reset,
    fire,
    update,
    draw,
    get active() { return active; },
    get x()      { return x; },
    get y()      { return y; },
    /** Chamado por CollisionSystem ao acertar um inimigo. */
    deactivate() { active = false; },
  };
})();