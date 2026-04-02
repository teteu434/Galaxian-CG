// ═══════════════════════════════════════════════════════════════
// src/render/renderer.js
// Função de renderização WebGL compartilhada por todas as entidades.
//
// Uma única drawSprite() serve para todos os objetos:
//   - Trocamos a textura e o uniforme uTransform a cada chamada
//   - Os VBOs (quad) são reutilizados — nenhuma alocação por frame
//
// Para a escala do jogo (~50 sprites/frame) isso é mais do que
// eficiente. Em jogos maiores usaríamos instanced rendering ou
// sprite batching.
//
// Dependências: GL (glContext.js)
// Exporta (global): drawSprite
// ═══════════════════════════════════════════════════════════════
"use strict";

/**
 * Desenha um sprite texturizado na posição dada.
 * @param {WebGLTexture} tex    Textura do sprite
 * @param {number}       x      X do canto superior esquerdo (px)
 * @param {number}       y      Y do canto superior esquerdo (px)
 * @param {number}       w      Largura (px)
 * @param {number}       h      Altura (px)
 * @param {number[]}     tint   Cor multiplicadora [r, g, b, a] em [0,1]
 * @param {number}       alpha  Opacidade global [0,1]
 */
function drawSprite(tex, x, y, w, h, tint = [1, 1, 1, 1], alpha = 1.0) {
  const { gl, locs, posBuffer, uvBuffer } = GL;

  // Bind da textura na texture unit 0
  gl.bindTexture(gl.TEXTURE_2D, tex);

  // Configura atributo de posição (lê do posBuffer)
  gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
  gl.enableVertexAttribArray(locs.aPosition);
  // 2 floats por vértice, stride=0 (tightly packed), offset=0
  gl.vertexAttribPointer(locs.aPosition, 2, gl.FLOAT, false, 0, 0);

  // Configura atributo de coordenada de textura (lê do uvBuffer)
  gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
  gl.enableVertexAttribArray(locs.aTexCoord);
  gl.vertexAttribPointer(locs.aTexCoord, 2, gl.FLOAT, false, 0, 0);

  // uTransform: posição e dimensões do sprite em pixels
  // O vertex shader faz a conversão px → clip space
  gl.uniform4f(locs.uTransform, x, y, w, h);

  // uTint: multiplicador de cor (branco = sem alteração)
  gl.uniform4f(locs.uTint, tint[0], tint[1], tint[2], tint[3]);

  // uAlpha: opacidade — usado para o efeito de piscar do jogador
  gl.uniform1f(locs.uAlpha, alpha);

  // TRIANGLE_STRIP com 4 vértices forma dois triângulos = um quad
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}