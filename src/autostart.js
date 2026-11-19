'use strict';
// Iniciar com o sistema no Linux: arquivo .desktop em ~/.config/autostart (padrão freedesktop).
const fs = require('fs');
const os = require('os');
const path = require('path');

const NOME_ARQUIVO = 'postigovpn.desktop';
const NOME_ARQUIVO_ANTIGO = 'openvpn-connect.desktop'; // do app antigo (OpenVPN Connect)

function pastaAutostart(env = process.env, casa = os.homedir()) {
  return path.join(env.XDG_CONFIG_HOME || path.join(casa, '.config'), 'autostart');
}

// Aspas do campo Exec: escapa \ " ` $ (freedesktop Desktop Entry Spec).
function citar(arg) { return '"' + String(arg).replace(/(["`$\\])/g, '\\$1') + '"'; }

// No AppImage o executável é o próprio arquivo (APPIMAGE), não o binário temporário montado.
function comandoExec({ env = process.env, execPath = process.execPath } = {}) {
  return `${citar(env.APPIMAGE || execPath)} --oculto`;
}

function conteudoDesktop(opcoes = {}) {
  return [
    '[Desktop Entry]', 'Type=Application', 'Name=PostigoVPN',
    'Comment=Interface para o OpenVPN (inicia na bandeja)', `Exec=${comandoExec(opcoes)}`,
    'Icon=postigovpn', 'Terminal=false', 'Categories=Network;Utility;',
    'X-GNOME-Autostart-enabled=true', 'Hidden=false', '',
  ].join('\n');
}

function arquivo(opcoes = {}) { return path.join(opcoes.pasta || pastaAutostart(opcoes.env), NOME_ARQUIVO); }
function estaAtivo(opcoes = {}) { return fs.existsSync(arquivo(opcoes)); }

function ativar(opcoes = {}) {
  const f = arquivo(opcoes);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, conteudoDesktop(opcoes), { mode: 0o644 });
  return f;
}
function desativar(opcoes = {}) { try { fs.unlinkSync(arquivo(opcoes)); } catch {} }

// Mantém o caminho correto se o AppImage foi movido ou atualizado.
function sincronizar(opcoes = {}) {
  if (estaAtivo(opcoes) && fs.readFileSync(arquivo(opcoes), 'utf8') !== conteudoDesktop(opcoes)) ativar(opcoes);
}

// Se o usuário tinha "iniciar com o sistema" no app antigo, troca o atalho antigo pelo novo.
function migrarAntigo(opcoes = {}) {
  const antigo = path.join(opcoes.pasta || pastaAutostart(opcoes.env), NOME_ARQUIVO_ANTIGO);
  if (!fs.existsSync(antigo)) return false;
  try { fs.unlinkSync(antigo); } catch {}
  ativar(opcoes);
  return true;
}

module.exports = { migrarAntigo, NOME_ARQUIVO_ANTIGO, pastaAutostart, citar, comandoExec, conteudoDesktop, estaAtivo, ativar, desativar, sincronizar, NOME_ARQUIVO };
