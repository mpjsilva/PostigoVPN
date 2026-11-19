'use strict';
// Migração do app antigo (OpenVPN Connect 1.0/1.1) para o PostigoVPN: conexões, credenciais e preferências.
// Só copia os arquivos do app (nada do cache do Chromium) e não apaga a pasta antiga.
const fs = require('fs');
const path = require('path');

const ARQUIVOS = ['perfis.json', 'config.json', 'credenciais.bin', 'chave.key'];
const SENSIVEIS = ['perfis.json', 'config.json', 'credenciais.bin', 'chave.key'];

// destino: pasta de dados nova; origens: pastas antigas possíveis (a primeira que tiver perfis.json vence).
// Retorna a origem usada, ou null se não migrou nada.
function migrarDadosAntigos(destino, origens) {
  if (fs.existsSync(path.join(destino, 'perfis.json'))) return null; // já tem dados: não mexe
  for (const o of origens) {
    if (path.resolve(o) === path.resolve(destino) || !fs.existsSync(path.join(o, 'perfis.json'))) continue;
    fs.mkdirSync(destino, { recursive: true, mode: 0o700 });
    for (const f of ARQUIVOS) {
      const de = path.join(o, f);
      if (fs.existsSync(de)) fs.copyFileSync(de, path.join(destino, f));
    }
    const pastaPerfis = path.join(o, 'perfis');
    if (fs.existsSync(pastaPerfis)) {
      fs.mkdirSync(path.join(destino, 'perfis'), { recursive: true, mode: 0o700 });
      for (const f of fs.readdirSync(pastaPerfis)) {
        if (/\.ovpn$/.test(f)) fs.copyFileSync(path.join(pastaPerfis, f), path.join(destino, 'perfis', f));
      }
    }
    // credenciais e chave nunca ficam legíveis por outros usuários
    for (const f of SENSIVEIS) { try { fs.chmodSync(path.join(destino, f), 0o600); } catch {} }
    try { fs.chmodSync(path.join(destino, 'perfis'), 0o700); fs.chmodSync(destino, 0o700); } catch {}
    return o;
  }
  return null;
}

module.exports = { migrarDadosAntigos };
