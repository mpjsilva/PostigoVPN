'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { nomeDoArquivo, precisaCredenciais } = require('./parse');

const FORMATO = 'openvpn-connect/conexoes';
const VERSAO_FORMATO = 1;

class Store {
  constructor(dir) {
    this.dir = dir;
    this.dirPerfis = path.join(dir, 'perfis');
    this.arqIndice = path.join(dir, 'perfis.json');
    this.arqConfig = path.join(dir, 'config.json');
    this.arqCred = path.join(dir, 'credenciais.bin');
    this.arqChave = path.join(dir, 'chave.key');
    fs.mkdirSync(this.dirPerfis, { recursive: true, mode: 0o700 });
    try { fs.chmodSync(dir, 0o700); } catch {}
    this.indice = this._ler(this.arqIndice, []);
    this.config = Object.assign({ tema: 'automatico', minimizarParaBandeja: true }, this._ler(this.arqConfig, {}));
  }

  _ler(arq, padrao) { try { return JSON.parse(fs.readFileSync(arq, 'utf8')); } catch { return padrao; } }
  _gravar(arq, dados) {
    const tmp = arq + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(dados, null, 2), { mode: 0o600 });
    fs.renameSync(tmp, arq);
  }

  // ---------- Configurações ----------
  getConfig() { return { ...this.config }; }
  setConfig(parcial) { Object.assign(this.config, parcial); this._gravar(this.arqConfig, this.config); return this.getConfig(); }

  // ---------- Perfis ----------
  listar() {
    return this.indice.map((p) => ({ ...p, temCredenciais: this.temCredenciais(p.id) }));
  }
  obter(id) { return this.indice.find((p) => p.id === id) || null; }
  caminho(id) { return path.join(this.dirPerfis, `${id}.ovpn`); }
  lerConfig(id) { return fs.readFileSync(this.caminho(id), 'utf8'); }

  _nomeUnico(base) {
    const usados = new Set(this.indice.map((p) => p.nome.toLowerCase()));
    if (!usados.has(base.toLowerCase())) return base;
    for (let i = 2; ; i++) if (!usados.has(`${base} (${i})`.toLowerCase())) return `${base} (${i})`;
  }

  adicionar(nome, texto) {
    if (!/^\s*(client|remote|dev)\b/m.test(texto)) throw new Error('Arquivo não parece um perfil OpenVPN válido.');
    const id = crypto.randomBytes(6).toString('hex');
    const perfil = { id, nome: this._nomeUnico(nome || 'Conexão'), exigeCredenciais: precisaCredenciais(texto), criadoEm: Date.now() };
    fs.writeFileSync(this.caminho(id), texto, { mode: 0o600 });
    this.indice.push(perfil);
    this._gravar(this.arqIndice, this.indice);
    return perfil;
  }

  importarArquivo(caminho) {
    const texto = fs.readFileSync(caminho, 'utf8');
    return this.adicionar(nomeDoArquivo(caminho), texto);
  }

  renomear(id, nome) {
    const p = this.obter(id); if (!p) throw new Error('Perfil não encontrado.');
    p.nome = String(nome).trim() || p.nome;
    this._gravar(this.arqIndice, this.indice);
    return p;
  }

  remover(id) {
    this.indice = this.indice.filter((p) => p.id !== id);
    try { fs.unlinkSync(this.caminho(id)); } catch {}
    this.esquecerCredenciais(id);
    this._gravar(this.arqIndice, this.indice);
  }

  // ---------- Credenciais (AES-256-GCM, chave própria 0600; sem keyring do sistema) ----------
  _chave() {
    try { return fs.readFileSync(this.arqChave); } catch {}
    const k = crypto.randomBytes(32);
    fs.writeFileSync(this.arqChave, k, { mode: 0o600 });
    return k;
  }
  _lerCred() {
    try {
      const b = fs.readFileSync(this.arqCred);
      const d = crypto.createDecipheriv('aes-256-gcm', this._chave(), b.subarray(0, 12));
      d.setAuthTag(b.subarray(12, 28));
      return JSON.parse(Buffer.concat([d.update(b.subarray(28)), d.final()]).toString('utf8'));
    } catch { return {}; }
  }
  _gravarCred(obj) {
    const iv = crypto.randomBytes(12);
    const c = crypto.createCipheriv('aes-256-gcm', this._chave(), iv);
    const enc = Buffer.concat([c.update(JSON.stringify(obj), 'utf8'), c.final()]);
    fs.writeFileSync(this.arqCred, Buffer.concat([iv, c.getAuthTag(), enc]), { mode: 0o600 });
  }
  temCredenciais(id) { return Boolean(this._lerCred()[id]); }
  obterCredenciais(id) { return this._lerCred()[id] || null; }
  salvarCredenciais(id, usuario, senha) { const o = this._lerCred(); o[id] = { usuario, senha }; this._gravarCred(o); }
  esquecerCredenciais(id) { const o = this._lerCred(); if (o[id]) { delete o[id]; this._gravarCred(o); } }

  // ---------- Exportar / importar conexões ----------
  // Pacote JSON com todos os perfis (nome + texto do .ovpn). Senhas só entram se pedido.
  exportar({ incluirCredenciais = false } = {}) {
    const cred = incluirCredenciais ? this._lerCred() : {};
    return {
      formato: FORMATO, versao: VERSAO_FORMATO, exportadoEm: new Date().toISOString(),
      incluiCredenciais: incluirCredenciais,
      conexoes: this.indice.map((p) => ({
        nome: p.nome, ovpn: this.lerConfig(p.id),
        ...(cred[p.id] ? { credenciais: cred[p.id] } : {}),
      })),
    };
  }

  // Aceita um pacote exportado (.json) ou um .ovpn/.conf avulso. Retorna { importadas, ignoradas }.
  importarPacoteOuArquivo(caminho) {
    const texto = fs.readFileSync(caminho, 'utf8');
    if (/\.json$/i.test(caminho)) return this.importarPacote(JSON.parse(texto));
    return { importadas: [this.adicionar(nomeDoArquivo(caminho), texto)], ignoradas: [] };
  }

  importarPacote(pacote) {
    if (!pacote || pacote.formato !== FORMATO || !Array.isArray(pacote.conexoes)) throw new Error('Arquivo de conexões inválido.');
    const importadas = [], ignoradas = [];
    for (const c of pacote.conexoes) {
      try {
        const p = this.adicionar(c.nome, String(c.ovpn));
        if (c.credenciais && c.credenciais.usuario) this.salvarCredenciais(p.id, c.credenciais.usuario, c.credenciais.senha || '');
        importadas.push(p);
      } catch (e) { ignoradas.push({ nome: c && c.nome, motivo: e.message }); }
    }
    return { importadas, ignoradas };
  }
}

module.exports = { Store, FORMATO };
