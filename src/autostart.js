'use strict';
// Iniciar com o sistema no Linux: arquivo .desktop em ~/.config/autostart (padrão freedesktop).
const fs = require('fs');
const os = require('os');
const path = require('path');

const NOME_ARQUIVO = 'openvpn-connect.desktop';

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
    '[Desktop Entry]', 'Type=Application', 'Name=OpenVPN Connect',
    'Comment=Cliente OpenVPN (inicia na bandeja)', `Exec=${comandoExec(opcoes)}`,
    'Icon=openvpn-connect', 'Terminal=false', 'Categories=Network;Utility;',
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

module.exports = { pastaAutostart, citar, comandoExec, conteudoDesktop, estaAtivo, ativar, desativar, sincronizar, NOME_ARQUIVO };
