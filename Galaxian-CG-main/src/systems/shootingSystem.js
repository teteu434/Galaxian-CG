// ═══════════════════════════════════════════════════════════════
// src/systems/shootingSystem.js
// Sem alterações estruturais — já usava NEW_SETTINGS corretamente.
// ═══════════════════════════════════════════════════════════════
"use strict";

const ShootingSystem = (() => {
  let cooldown = 0;

  function update(dt) {
    if (cooldown > 0) cooldown -= dt;

    const keyShoot = SettingsSystem.get('keyShoot') || ['Space'];
    if (Input.wasPressedAny(keyShoot) && cooldown <= 0 && Player.alive) {
      Bullet.fire(Player.cx, Player.cy);
      cooldown = 0.15;
    }
  }

  function reset() { cooldown = 0; }

  return { update, reset };
})();