// ═══════════════════════════════════════════════════════════════
// src/systems/settingsSystem.js
// Gerenciamento centralizado de configurações.
//
// ⚠️  PONTO CRÍTICO — unicidade de teclas:
//   setKeyMapping() remove a tecla de qualquer outra ação antes
//   de atribuí-la, garantindo que não existam duas ações com a
//   mesma tecla simultaneamente.
//
// ⚠️  PONTO CRÍTICO — reset seguro:
//   reset() usa cloneSettings() para evitar referências
//   compartilhadas entre NEW_SETTINGS e DEFAULT_SETTINGS.
// ═══════════════════════════════════════════════════════════════
"use strict";

const SettingsSystem = (() => {
  // Ações remapeáveis (arrays de teclas, uma tecla por ação no menu)
  const KEY_ACTIONS = ['keyLeft', 'keyRight', 'keyShoot', 'keyPause', 'keyRestart'];

  // ── Leitura ──────────────────────────────────────────────────
  function get(key) {
    return NEW_SETTINGS[key];
  }

  function getAll() {
    // Retorna cópia para evitar mutação acidental externa
    return cloneSettings(NEW_SETTINGS);
  }

  // ── Escrita genérica (volumes, booleans, etc.) ───────────────
  function set(key, value) {
    NEW_SETTINGS[key] = value;
    save();
  }

  // ── Remapeamento de tecla ────────────────────────────────────
  // Garante: 1 tecla por ação, sem conflitos entre ações.
  function setKeyMapping(action, newCode) {
    if (!KEY_ACTIONS.includes(action)) {
      console.warn(`SettingsSystem: ação desconhecida "${action}"`);
      return;
    }
    if (!newCode || typeof newCode !== 'string') {
      console.warn('SettingsSystem: código de tecla inválido');
      return;
    }

    // Remove a tecla de qualquer outra ação que já a possua
    for (const other of KEY_ACTIONS) {
      if (other === action) continue;
      const keys = NEW_SETTINGS[other];
      if (Array.isArray(keys) && keys.includes(newCode)) {
        NEW_SETTINGS[other] = keys.filter(k => k !== newCode);
      }
    }

    // Atribui a nova tecla à ação (substitui completamente o array)
    // O menu de remapeamento trabalha com exactly 1 tecla por ação.
    NEW_SETTINGS[action] = [newCode];

    save();
  }

  // ── Reset ────────────────────────────────────────────────────
  // Recopia DEFAULT_SETTINGS → NEW_SETTINGS sem referências compartilhadas.
  function reset() {
    const fresh = cloneSettings(DEFAULT_SETTINGS);
    for (const key of Object.keys(fresh)) {
      NEW_SETTINGS[key] = fresh[key];
    }
    save();
  }

  // ── Persistência ─────────────────────────────────────────────
  function save() {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(NEW_SETTINGS));
    } catch (e) {
      console.error('SettingsSystem: falha ao salvar no localStorage', e);
    }
  }

  function load() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) return; // nada salvo: mantém os defaults

      const parsed = JSON.parse(raw);

      // Valida e mescla: só aceita chaves conhecidas com tipos corretos
      for (const key of Object.keys(DEFAULT_SETTINGS)) {
        if (!(key in parsed)) continue;

        const defaultVal = DEFAULT_SETTINGS[key];
        const savedVal   = parsed[key];

        if (Array.isArray(defaultVal)) {
          // Garante que seja array de strings não-vazio
          if (Array.isArray(savedVal) && savedVal.length > 0 &&
              savedVal.every(k => typeof k === 'string')) {
            NEW_SETTINGS[key] = savedVal;
          }
        } else if (typeof defaultVal === typeof savedVal) {
          NEW_SETTINGS[key] = savedVal;
        }
        // Caso contrário, mantém o default (proteção contra dados corrompidos)
      }
    } catch (e) {
      console.error('SettingsSystem: falha ao carregar do localStorage', e);
      // Em caso de erro, reseta para defaults sem quebrar o jogo
      reset();
    }
  }

  return { get, getAll, set, setKeyMapping, reset, save, load };
})();s