// ═══════════════════════════════════════════════════════════════
// src/render/shaders.js
// Código-fonte GLSL dos shaders vertex e fragment.
//
// Um único par de shaders serve todos os sprites:
//   - uTransform  (vec4: x, y, w, h em px) posiciona o quad
//   - uTint       (vec4 rgba) permite coloração
//   - uAlpha      (float) opacidade global (piscar jogador)
//   - uTexture    (sampler2D) textura do sprite
//
// Dependências: nenhuma
// Exporta (global): VERT_SRC, FRAG_SRC
// ═══════════════════════════════════════════════════════════════
"use strict";

const VERT_SRC = `
  attribute vec2 aPosition; /* posição normalizada do quad [0,1] */
  attribute vec2 aTexCoord; /* coordenada de textura [0,1]       */

  uniform vec2 uResolution; /* resolução do canvas em pixels     */
  uniform vec4 uTransform;  /* rect do sprite: x, y, w, h em px */

  varying vec2 vTexCoord;

  void main() {
    /* Expande o quad unitário [0,1] para as dimensões reais do sprite */
    vec2 pixelPos = aPosition * uTransform.zw + uTransform.xy;

    /* Converte coordenadas px → clip space [-1, 1].
       WebGL: origem no centro, Y cresce para cima.
       Pixels: origem no topo-esquerdo, Y cresce para baixo. */
    vec2 clipPos  = (pixelPos / uResolution) * 2.0 - 1.0;
    clipPos.y     = -clipPos.y;

    gl_Position = vec4(clipPos, 0.0, 1.0);
    vTexCoord   = aTexCoord;
  }
`;

const FRAG_SRC = `
  precision mediump float;

  uniform sampler2D uTexture; /* textura do sprite           */
  uniform vec4      uTint;    /* multiplicador de cor (rgba) */
  uniform float     uAlpha;   /* opacidade global            */

  varying vec2 vTexCoord;

  void main() {
    vec4 texColor = texture2D(uTexture, vTexCoord);
    /* Aplica tint e alpha — permite piscar/colorir sem trocar shader */
    gl_FragColor  = texColor * uTint * vec4(1.0, 1.0, 1.0, uAlpha);
  }
`;