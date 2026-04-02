// ═══════════════════════════════════════════════════════════════
// src/systems/shootingSystem.js
// Sistema de disparo do jogador com debounce de cooldown.
//
// Por que cooldown além do limite de 1 tiro?
//   Sem cooldown, pressionar Espaço no mesmo frame em que o tiro
//   anterior acerta/sai já dispararia outro imediatamente.
//   O cooldown de 150ms dá uma janela mínima entre disparos,
//   tornando o ritmo mais controlado e intencional.
//
// Dependências:
//   Input   (systems/input.js)
//   Bullet  (entities/bullet.js)
//   Player  (entities/player.js)
// Exporta (global): ShootingSystem
// ═══════════════════════════════════════════════════════════════
"use strict";

const ShootingSystem = (() => {
  let cooldown = 0; // segundos restantes até poder atirar

  function update(dt) {
    if (cooldown > 0) cooldown -= dt;

    // wasPressed garante que o disparo ocorre apenas uma vez por pressão
    if (Input.wasPressed('Space') && cooldown <= 0 && Player.alive) {
      Bullet.fire(Player.cx, Player.cy);
      cooldown = 0.15; // 150ms de intervalo mínimo entre tiros
    }
  }

  function reset() {
    cooldown = 0;
  }

  return { update, reset };
})();