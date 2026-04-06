// ═══════════════════════════════════════════════════════════════
// src/systems/settingsSystem.js
// Gerenciamento de configurações do jogo com persistência localStorage
// ═══════════════════════════════════════════════════════════════
"use strict";

const SettingsSystem = (() => {
  let currentSettings = { ...DEFAULT_SETTINGS };
  
  /**
   * Carrega configurações do localStorage
   */
  function load() {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        currentSettings = { ...DEFAULT_SETTINGS, ...parsed };
      } catch (e) {
        console.warn('Erro ao carregar configurações:', e);
      }
    }
    return { ...currentSettings };
  }
  
  /**
   * Salva configurações no localStorage
   */
  function save() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(currentSettings));
  }
  
  /**
   * Obtém uma configuração específica
   */
  function get(key) {
    return currentSettings[key];
  }
  
  /**
   * Define uma configuração específica
   */
  function set(key, value) {
    currentSettings[key] = value;
    save();
    
    // Notifica sistemas sobre mudanças
    if (AudioSystem && AudioSystem.updateSettings) {
      AudioSystem.updateSettings(currentSettings);
    }
  }
  
  /**
   * Obtém todas as configurações
   */
  function getAll() {
    return { ...currentSettings };
  }
  
  /**
   * Reseta para configurações padrão
   */
  function reset() {
    currentSettings = { ...DEFAULT_SETTINGS };
    save();
    
    if (AudioSystem && AudioSystem.updateSettings) {
      AudioSystem.updateSettings(currentSettings);
    }
  }
  
  /**
   * Verifica se uma tecla está sendo usada
   */
  function isKeyUsed(key, excludeAction = null) {
    for (const [action, keys] of Object.entries(currentSettings)) {
      if (action === excludeAction) continue;
      if (action.startsWith('key') && keys.includes(key)) {
        return action;
      }
    }
    return null;
  }
  
  /**
   * Define um mapeamento de tecla
   */
  function setKeyMapping(action, key) {
    if (!currentSettings[action]) return false;
    
    // Verifica se tecla já está em uso
    const usedBy = isKeyUsed(key, action);
    if (usedBy) {
      // Remove a tecla do outro mapeamento
      const index = currentSettings[usedBy].indexOf(key);
      if (index !== -1) {
        currentSettings[usedBy].splice(index, 1);
      }
    }
    
    // Adiciona a nova tecla (se não existir)
    if (!currentSettings[action].includes(key)) {
      currentSettings[action].push(key);
    }
    
    save();
    return true;
  }
  
  /**
   * Remove um mapeamento de tecla
   */
  function removeKeyMapping(action, key) {
    if (!currentSettings[action]) return false;
    const index = currentSettings[action].indexOf(key);
    if (index !== -1) {
      currentSettings[action].splice(index, 1);
      save();
      return true;
    }
    return false;
  }
  
  // Carrega configurações na inicialização
  load();
  
  return {
    load,
    save,
    get,
    set,
    getAll,
    reset,
    isKeyUsed,
    setKeyMapping,
    removeKeyMapping
  };
})();