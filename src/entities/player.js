// ═══════════════════════════════════════════════════════════════
// src/entities/player.js
// Entidade do jogador: posição, movimento, efeito de morte.
//
// MODIFICADO: Adicionado suporte para controle por mouse via setX()
//
// Dependências:
//   Input       (systems/input.js)
//   drawSprite  (render/renderer.js)
//   TEX         (render/textureLoader.js)
//   CANVAS_W, PLAYER_SPEED, PLAYER_W, PLAYER_H, PLAYER_Y (constants.js)
// Exporta (global): Player
// ═══════════════════════════════════════════════════════════════
"use strict";

const Player = (() => {
  let x, y, alive, blinkTimer, blinkAlpha;

  function reset() {
    x          = CANVAS_W / 2 - PLAYER_W / 2; // centralizado horizontalmente
    y          = PLAYER_Y;
    alive      = true;
    blinkTimer = 0;
    blinkAlpha = 1;
  }

  function update(dt) {
    // Movimento lateral contínuo via teclado (polling) com clamping nas bordas
    if (Input.isDown('ArrowLeft') || Input.isDown('KeyA')) {
      x = Math.max(0, x - PLAYER_SPEED * dt);
    }
    if (Input.isDown('ArrowRight') || Input.isDown('KeyD')) {
      x = Math.min(CANVAS_W - PLAYER_W, x + PLAYER_SPEED * dt);
    }

    // Efeito de piscar após ser atingido (antes do game over ser exibido)
    if (!alive) {
      blinkTimer += dt;
      // sin() oscila — quando |sin| > 0.5 mostra, senão esconde
      blinkAlpha = Math.abs(Math.sin(blinkTimer * 15)) > 0.5 ? 0 : 1;
    }
  }

  function draw() {
    // Não renderiza quando invisível no ciclo de piscar
    if (!alive && blinkAlpha === 0) return;
    drawSprite(TEX.player, x, y, PLAYER_W, PLAYER_H, [1, 1, 1, 1], alive ? 1 : blinkAlpha);
  }

  /**
   * Define a posição X do jogador (usado para controle por mouse)
   * @param {number} newX - Nova posição X em pixels
   */
  function setX(newX) {
    // Aplica clamping para manter dentro dos limites da tela
    x = Math.max(0, Math.min(CANVAS_W - PLAYER_W, newX));
  }

  return {
    reset,
    update,
    draw,
    setX,           // NOVO: método para controle por mouse
    get x()     { return x; },
    get y()     { return y; },
    get alive() { return alive; },
    /** Centro X do sprite — usado para spawn do tiro. */
    get cx()    { return x + PLAYER_W / 2; },
    /** Topo do sprite — ponto de origem do tiro. */
    get cy()    { return y; },
    kill()      { alive = false; },
  };
})();