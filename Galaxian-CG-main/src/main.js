// ═══════════════════════════════════════════════════════════════
// src/main.js
// Ponto de entrada da aplicação.
//
// Responsabilidade única: iniciar o jogo após todos os scripts
// terem sido carregados pelo navegador.
//
// Por que um arquivo separado para uma única linha?
//   - Deixa claro onde o jogo começa
//   - Facilita adicionar lógica de pré-carregamento futura
//     (ex: aguardar assets externos, exibir splash screen)
//   - Segue o princípio de responsabilidade única
//
// Dependências: Game (core/game.js) — deve ser o último script carregado
// ═══════════════════════════════════════════════════════════════
"use strict";

Game.start();