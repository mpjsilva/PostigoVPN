'use strict';
const { spawn, execFileSync } = require('child_process');
const net = require('net');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const EventEmitter = require('events');
const P = require('./parse');

function acharExecutavel(nome, dirs) {
  for (const d of dirs || ['/usr/sbin', '/usr/bin', '/sbin', '/bin', '/usr/local/sbin', '/usr/local/bin']) {
    const c = path.join(d, nome);
    try { fs.accessSync(c, fs.constants.X_OK); return c; } catch {}
  }
  return null;
}

function portaLivre() {
  return new Promise((ok, erro) => {
    const s = net.createServer();
    s.once('error', erro);
    s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => ok(p)); });
  });
}

// Estados emitidos: desconectado, conectando, autenticando, conectado, reconectando, desconectando, erro.
class Conexao extends EventEmitter {
  constructor({ dirs } = {}) {
    super();
    this.dirs = dirs || null; // só para testes
    this.estado = 'desconectado';
    this.perfilId = null;
    this.filho = null;
    this.sock = null;
    this.tmp = null;
    this.encerrando = false;
    this.erroFinal = null;
  }

  dependencias() {
    return { openvpn: acharExecutavel('openvpn', this.dirs), pkexec: acharExecutavel('pkexec', this.dirs) };
  }

  _definir(estado, extra = {}) {
    this.estado = estado;
    this.emit('estado', { estado, perfilId: this.perfilId, ...extra });
  }
  _log(texto, nivel = 'I') { this.emit('log', { ts: Math.floor(Date.now() / 1000), nivel, texto }); }

  async conectar({ perfilId, caminhoOvpn, credenciais }) {
    if (this.filho) throw new Error('Já existe uma conexão ativa.');
    const dep = this.dependencias();
    if (!dep.openvpn) throw new Error('OpenVPN não encontrado. Instale com: sudo apt install openvpn');
    if (!dep.pkexec) throw new Error('pkexec (polkit) não encontrado. Instale: sudo apt install policykit-1');

    this.perfilId = perfilId; this.encerrando = false; this.erroFinal = null;
    this.tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ovpnc-'));
    fs.chmodSync(this.tmp, 0o700);
    const senhaMgmt = crypto.randomBytes(16).toString('hex');
    const arqMgmt = path.join(this.tmp, 'mgmt');
    fs.writeFileSync(arqMgmt, senhaMgmt + '\n', { mode: 0o600 });
    const porta = await portaLivre();

    const args = [dep.openvpn, '--config', caminhoOvpn, '--cd', path.dirname(caminhoOvpn),
      '--management', '127.0.0.1', String(porta), arqMgmt, '--verb', '3'];
    if (credenciais) {
      const arqAuth = path.join(this.tmp, 'auth');
      fs.writeFileSync(arqAuth, `${credenciais.usuario}\n${credenciais.senha}\n`, { mode: 0o600 });
      args.push('--auth-user-pass', arqAuth);
    }

    this._definir('conectando');
    this._log('Solicitando autorização para iniciar o OpenVPN…');
    this.filho = spawn(dep.pkexec, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    this.filho.stdout.on('data', (d) => this._linhasBrutas(d));
    this.filho.stderr.on('data', (d) => this._linhasBrutas(d));
    this.filho.on('error', (e) => { this.erroFinal = e.message; });
    this.filho.on('exit', (codigo) => this._aoSair(codigo));
    this._abrirGerenciamento(porta, senhaMgmt);
  }

  _linhasBrutas(d) {
    // Antes da interface de gerenciamento subir, o que o OpenVPN imprime vem por aqui.
    if (this.sock) return;
    for (const l of String(d).split(/\r?\n/)) if (l.trim()) this._log(l.trim());
  }

  _abrirGerenciamento(porta, senha, tentativa = 0) {
    if (!this.filho) return;
    const s = net.connect(porta, '127.0.0.1');
    let buf = '', autenticado = false;
    s.on('connect', () => { this.sock = s; });
    s.on('data', (d) => {
      buf += d.toString('utf8');
      let i;
      while ((i = buf.search(/\r?\n/)) >= 0 || (!autenticado && /ENTER PASSWORD:/.test(buf))) {
        if (i < 0) { buf = ''; s.write(senha + '\n'); autenticado = true; s.write('state on\nlog on all\nbytecount 2\nstate\n'); break; }
        const linha = buf.slice(0, i).replace(/\r$/, ''); buf = buf.slice(i + (buf[i] === '\r' ? 2 : 1));
        this._linhaMgmt(linha);
      }
    });
    s.on('error', () => {
      this.sock = null;
      if (this.filho && !this.encerrando && tentativa < 600) setTimeout(() => this._abrirGerenciamento(porta, senha, tentativa + 1), 500);
    });
    s.on('close', () => { if (this.sock === s) this.sock = null; });
  }

  _linhaMgmt(l) {
    if (!l) return;
    const st = P.parseState(l);
    if (st) {
      if (st.estado === 'desconectado') return;
      this._definir(st.estado, { ipLocal: st.ipLocal, ipRemoto: st.ipRemoto, detalhe: st.detalhe });
      return;
    }
    const by = P.parseBytes(l); if (by) { this.emit('bytes', by); return; }
    const lg = P.parseLog(l); if (lg) { this.emit('log', lg); if (/AUTH_FAILED/.test(lg.texto)) this.erroFinal = 'Usuário ou senha incorretos.'; return; }
    if (P.falhaDeAutenticacao(l)) { this.erroFinal = 'Usuário ou senha incorretos.'; return; }
    if (/^>PASSWORD:Need/.test(l)) this.erroFinal = 'Este perfil precisa de usuário e senha.';
  }

  desconectar() {
    if (!this.filho) return;
    this.encerrando = true;
    this._definir('desconectando');
    if (this.sock) { try { this.sock.write('signal SIGTERM\n'); } catch {} }
    else { try { this.filho.kill('SIGTERM'); } catch {} }
    const f = this.filho;
    setTimeout(() => { if (this.filho === f) { try { f.kill('SIGKILL'); } catch {} } }, 8000);
  }

  _aoSair(codigo) {
    const motivo = P.motivoDeSaida(codigo);
    try { if (this.sock) this.sock.destroy(); } catch {}
    this.sock = null; this.filho = null;
    if (this.tmp) { try { fs.rmSync(this.tmp, { recursive: true, force: true }); } catch {} this.tmp = null; }
    const falhou = !this.encerrando && (motivo || this.erroFinal || codigo);
    const msg = motivo || this.erroFinal || (codigo ? `O OpenVPN terminou com código ${codigo}.` : null);
    this._log(this.encerrando ? 'Conexão encerrada.' : (msg || 'Conexão encerrada.'));
    const pid = this.perfilId; this.perfilId = null;
    this.estado = falhou ? 'erro' : 'desconectado';
    this.emit('estado', { estado: this.estado, perfilId: pid, mensagem: falhou ? msg : null });
  }
}

module.exports = { Conexao, acharExecutavel };
