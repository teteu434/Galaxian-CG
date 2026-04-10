// ═══════════════════════════════════════════════════════════════
// src/utils/math.js
// Utilitários matemáticos do jogo.
//
// Usamos AABB (Axis-Aligned Bounding Box) para colisão porque:
//   - É O(1) por par de objetos
//   - Suficientemente preciso para sprites retangulares
//   - Não exige tesselação por pixel nem polygon math
//
// Dependências: nenhuma
// Exporta (global): aabbOverlap
// ═══════════════════════════════════════════════════════════════
"use strict";

/**
 * Retorna true se os dois retângulos se intersectam.
 * @param {number} ax  X do canto superior esquerdo do retângulo A
 * @param {number} ay  Y do canto superior esquerdo do retângulo A
 * @param {number} aw  Largura do retângulo A
 * @param {number} ah  Altura do retângulo A
 * @param {number} bx  X do canto superior esquerdo do retângulo B
 * @param {number} by  Y do canto superior esquerdo do retângulo B
 * @param {number} bw  Largura do retângulo B
 * @param {number} bh  Altura do retângulo B
 */
function aabbOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw &&
         ax + aw > bx &&
         ay < by + bh &&
         ay + ah > by;
}