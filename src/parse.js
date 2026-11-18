'use strict';
// Funções puras (sem Electron) para interpretar a saída do OpenVPN.

const ESTADOS = {
  CONNECTING: 'conectando', WAIT: 'conectando', AUTH: 'autenticando', GET_CONFIG: 'autenticando',
  ASSIGN_IP: 'conectando', ADD_ROUTES: 'conectando', CONNECTED: 'conectado',
  RECONNECTING: 'reconectando', EXITING: 'desconectado', RESOLVE: 'conectando',
  TCP_CONNECT: 'conectando', TLS_ERROR: 'erro',
};

// ">STATE:1700000000,CONNECTED,SUCCESS,10.8.0.2,1.2.3.4,1194,,"
function parseState(linha) {
  const m = /^>STATE:(\d+),([A-Z_]+),([^,]*),([^,]*),([^,]*)/.exec(linha);
  if (!m) return null;
  return { ts: Number(m[1]), nome: m[2], estado: ESTADOS[m[2]] || 'conectando', detalhe: m[3], ipLocal: m[4], ipRemoto: m[5] };
}

// ">BYTECOUNT:123,456" (entrada, saída)
function parseBytes(linha) {
  const m = /^>BYTECOUNT:(\d+),(\d+)/.exec(linha);
  return m ? { entrada: Number(m[1]), saida: Number(m[2]) } : null;
}

// ">LOG:1700000000,I,mensagem"
function parseLog(linha) {
  const m = /^>LOG:(\d+),([A-Za-z]*),(.*)$/.exec(linha);
  return m ? { ts: Number(m[1]), nivel: m[2], texto: m[3] } : null;
}

// ">PASSWORD:Verification Failed: 'Auth'"
function falhaDeAutenticacao(linha) {
  return /^>PASSWORD:Verification Failed/i.test(linha);
}

// O perfil pede usuário/senha quando tem "auth-user-pass" sem arquivo de credenciais.
function precisaCredenciais(texto) {
  return String(texto).split(/\r?\n/).some((l) => /^\s*auth-user-pass\s*(#.*)?$/.test(l));
}

function formatarBytes(n) {
  if (!Number.isFinite(n) || n < 1024) return `${n || 0} B`;
  const u = ['KB', 'MB', 'GB', 'TB'];
  let v = n / 1024, i = 0;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${u[i]}`;
}

function nomeDoArquivo(caminho) {
  return String(caminho).split(/[\\/]/).pop().replace(/\.(ovpn|conf)$/i, '');
}

// Erro conhecido do pkexec: 126 = não autorizado/cancelado, 127 = falha na autenticação.
function motivoDeSaida(codigo) {
  if (codigo === 126) return 'Autorização cancelada.';
  if (codigo === 127) return 'Falha ao pedir autorização (pkexec).';
  return null;
}

module.exports = { parseState, parseBytes, parseLog, falhaDeAutenticacao, precisaCredenciais, formatarBytes, nomeDoArquivo, motivoDeSaida };
