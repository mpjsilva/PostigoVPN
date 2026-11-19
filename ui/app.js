'use strict';
const $ = (id) => document.getElementById(id);
const E = { perfis: [], selecionado: null, estado: { estado: 'desconectado', perfilId: null }, config: {}, desde: null, ipRemoto: '', ipLocal: '', erro: '' };
const ROTULO = { desconectado: 'Desconectado', conectando: 'Conectando…', autenticando: 'Autenticando…', conectado: 'Conectado', reconectando: 'Reconectando…', desconectando: 'Desconectando…', erro: 'Erro na conexão' };
const ATIVOS = ['conectando', 'autenticando', 'conectado', 'reconectando', 'desconectando'];

function fmtBytes(n) {
  if (!n || n < 1024) return `${n || 0} B`;
  const u = ['KB', 'MB', 'GB', 'TB']; let v = n / 1024, i = 0;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${u[i]}`;
}
function fmtTempo(ms) {
  const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  return (h ? `${h}:${String(m).padStart(2, '0')}` : `${m}`) + `:${String(x).padStart(2, '0')}`;
}
function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.remove('hidden'); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.add('hidden'), 3200); }

// ---------- Modal ----------
function modal({ titulo, corpo, acoes }) {
  return new Promise((ok) => {
    $('m-titulo').textContent = titulo;
    const c = $('m-corpo'); c.replaceChildren();
    if (typeof corpo === 'string') c.textContent = corpo; else if (corpo) c.append(corpo);
    const a = $('m-acoes'); a.replaceChildren();
    const fechar = (v) => { $('modal').classList.add('hidden'); document.removeEventListener('keydown', tecla); ok(v); };
    const tecla = (e) => { if (e.key === 'Escape') fechar(null); };
    for (const x of acoes) {
      const b = document.createElement('button'); b.className = 'btn' + (x.classe ? ' ' + x.classe : ''); b.textContent = x.rotulo;
      b.onclick = () => fechar(x.valor); a.append(b);
    }
    document.addEventListener('keydown', tecla);
    $('modal').classList.remove('hidden');
    (c.querySelector('input') || a.lastChild).focus();
  });
}

// ---------- Tema ----------
function aplicarTema(t) {
  if (t === 'claro' || t === 'escuro') document.documentElement.dataset.tema = t; else delete document.documentElement.dataset.tema;
  document.querySelectorAll('#tema button').forEach((b) => b.classList.toggle('ativo', b.dataset.tema === t));
}

// ---------- Lista ----------
function perfilAtual() { return E.perfis.find((p) => p.id === E.selecionado) || null; }
function estadoDe(id) { return E.estado.perfilId === id ? E.estado.estado : 'desconectado'; }

function desenharLista() {
  const ul = $('lista'); ul.replaceChildren();
  $('lista-vazia').classList.toggle('hidden', E.perfis.length > 0);
  for (const p of E.perfis) {
    const li = document.createElement('li'); li.tabIndex = 0; li.setAttribute('role', 'option');
    li.className = p.id === E.selecionado ? 'sel' : ''; li.setAttribute('aria-selected', p.id === E.selecionado);
    const ponto = document.createElement('span'); ponto.className = 'ponto ' + estadoDe(p.id);
    const nome = document.createElement('span'); nome.className = 'nome'; nome.textContent = p.nome;
    li.append(ponto, nome);
    li.onclick = () => selecionar(p.id);
    li.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selecionar(p.id); } };
    ul.append(li);
  }
}

function selecionar(id) { E.selecionado = id; E.erro = ''; desenhar(); }

function desenhar() {
  if (!E.perfis.find((p) => p.id === E.selecionado)) E.selecionado = (E.perfis[0] || {}).id || null;
  desenharLista();
  const p = perfilAtual();
  $('vazio-geral').classList.toggle('hidden', Boolean(p));
  $('detalhe').classList.toggle('hidden', !p);
  if (!p) return;
  const est = estadoDe(p.id), ativo = ATIVOS.includes(est);
  const outroAtivo = ATIVOS.includes(E.estado.estado) && E.estado.perfilId !== p.id;
  $('d-nome').textContent = p.nome;
  $('d-estado').textContent = ROTULO[est];
  $('ponto').className = 'ponto ' + est;

  const pedeCred = p.exigeCredenciais && !p.temCredenciais;
  $('credenciais').classList.toggle('hidden', !p.exigeCredenciais || ativo);
  $('b-esquecer').classList.toggle('hidden', !p.temCredenciais);
  $('c-usuario').placeholder = p.temCredenciais ? 'Salvo — deixe em branco para usar' : '';
  $('c-senha').placeholder = p.temCredenciais ? '••••••••' : '';

  const b = $('b-conectar');
  b.className = 'btn grande ' + (ativo ? 'encerrar' : 'primario');
  b.textContent = ativo ? (est === 'desconectando' ? 'Desconectando…' : 'Desconectar') : 'Conectar';
  b.disabled = est === 'desconectando' || outroAtivo;
  b.title = outroAtivo ? 'Outra conexão está ativa.' : '';
  $('b-remover').disabled = ativo; $('b-renomear').disabled = ativo;
  const erro = $('erro'); erro.textContent = E.erro; erro.classList.toggle('hidden', !E.erro || ativo);

  const conectado = est === 'conectado';
  $('s-servidor').textContent = ativo && E.ipRemoto ? E.ipRemoto : '—';
  $('s-ip').textContent = conectado && E.ipLocal ? E.ipLocal : '—';
  if (!ativo) { $('s-tempo').textContent = '—'; $('s-in').textContent = '—'; $('s-out').textContent = '—'; }
}

// ---------- Ações ----------
async function alternarConexao() {
  const p = perfilAtual(); if (!p) return;
  if (ATIVOS.includes(estadoDe(p.id))) { await window.api.desconectar(); return; }
  E.erro = '';
  const usuario = $('c-usuario').value.trim(), senha = $('c-senha').value;
  if (p.exigeCredenciais && !p.temCredenciais && (!usuario || !senha)) { E.erro = 'Informe usuário e senha.'; desenhar(); return; }
  $('log').textContent = '';
  const r = await window.api.conectar({ id: p.id, usuario: usuario || undefined, senha: usuario ? senha : undefined, lembrar: $('c-lembrar').checked });
  $('c-senha').value = '';
  if (!r.ok) { E.erro = r.motivo; desenhar(); }
}

async function importar() {
  const r = await window.api.importarArquivos();
  E.perfis = r.perfis;
  if (r.importadas.length) E.selecionado = r.importadas[r.importadas.length - 1].id;
  desenhar();
  if (r.ignoradas.length) {
    const ul = document.createElement('div'); ul.textContent = r.ignoradas.map((i) => `• ${i.nome || 'arquivo'}: ${i.motivo}`).join('\n'); ul.style.whiteSpace = 'pre-wrap';
    await modal({ titulo: `${r.importadas.length} importada(s), ${r.ignoradas.length} ignorada(s)`, corpo: ul, acoes: [{ rotulo: 'OK', valor: true, classe: 'primario' }] });
  } else if (r.importadas.length) toast(r.importadas.length === 1 ? `Importada: ${r.importadas[0].nome}` : `${r.importadas.length} conexões importadas`);
}

async function exportar() {
  if (!E.perfis.length) { toast('Não há conexões para exportar.'); return; }
  const corpo = document.createElement('div');
  corpo.append('Todas as conexões vão para um arquivo .json que pode ser importado em outro computador.');
  const lab = document.createElement('label'); const cb = document.createElement('input'); cb.type = 'checkbox';
  lab.append(cb, 'Incluir usuários e senhas salvos (sem criptografia no arquivo)'); corpo.append(lab);
  const v = await modal({ titulo: 'Exportar conexões', corpo, acoes: [{ rotulo: 'Cancelar', valor: null }, { rotulo: 'Exportar', valor: true, classe: 'primario' }] });
  if (!v) return;
  const r = await window.api.exportarConexoes(cb.checked);
  if (r.ok) toast(`${r.total} conexão(ões) exportada(s)`); else if (!r.cancelado) toast(r.motivo || 'Falha ao exportar.');
}

async function renomear() {
  const p = perfilAtual(); if (!p) return;
  const inp = document.createElement('input'); inp.className = 'texto'; inp.value = p.nome; inp.spellcheck = false;
  const corpo = document.createElement('div'); corpo.append('Novo nome:', inp);
  inp.onkeydown = (e) => { if (e.key === 'Enter') document.querySelector('#m-acoes .primario').click(); };
  const v = await modal({ titulo: 'Renomear conexão', corpo, acoes: [{ rotulo: 'Cancelar', valor: null }, { rotulo: 'Salvar', valor: true, classe: 'primario' }] });
  if (v && inp.value.trim()) { E.perfis = await window.api.renomear(p.id, inp.value.trim()); desenhar(); }
}

async function remover() {
  const p = perfilAtual(); if (!p) return;
  const v = await modal({ titulo: 'Remover conexão', corpo: `“${p.nome}” e as credenciais salvas serão apagadas deste computador.`, acoes: [{ rotulo: 'Cancelar', valor: null }, { rotulo: 'Remover', valor: true, classe: 'perigo' }] });
  if (!v) return;
  try { E.perfis = await window.api.remover(p.id); E.selecionado = null; desenhar(); } catch (e) { toast(e.message.replace(/^Error invoking remote method '[^']+': Error: /, '')); }
}

async function preferencias() {
  const pr = await window.api.prefs();
  const caixa = document.createElement('div'); caixa.className = 'prefs-lista';
  const linha = (titulo, dica, ligado, aoMudar) => {
    const l = document.createElement('label'); l.className = 'pref';
    const t = document.createElement('span'); t.append(titulo); const d = document.createElement('small'); d.textContent = dica; t.append(d);
    const sw = document.createElement('span'); sw.className = 'interruptor';
    const i = document.createElement('input'); i.type = 'checkbox'; i.checked = ligado; i.onchange = () => aoMudar(i.checked, i);
    sw.append(i, document.createElement('span')); l.append(t, sw); return l;
  };
  caixa.append(
    linha('Iniciar com o sistema', 'Abre na bandeja ao entrar na sessão.', pr.iniciarComSistema, async (v, i) => { i.checked = await window.api.setIniciarComSistema(v); }),
    linha('Manter na bandeja ao fechar', 'Fechar a janela não encerra a VPN.', pr.config.minimizarParaBandeja !== false, (v) => window.api.setConfig({ minimizarParaBandeja: v })),
    linha('Atualizar automaticamente', 'Procura versões novas a cada 6 horas e pergunta antes de instalar.', pr.config.atualizacaoAutomatica !== false, (v) => window.api.setConfig({ atualizacaoAutomatica: v })),
  );
  const v = document.createElement('div'); v.className = 'pref-versao'; v.textContent = `Versão ${pr.versao}`; caixa.append(v);
  const r = await modal({ titulo: 'Preferências', corpo: caixa, acoes: [{ rotulo: 'Buscar atualização', valor: 'buscar' }, { rotulo: 'Fechar', valor: null, classe: 'primario' }] });
  if (r === 'buscar') { const x = await window.api.buscarAtualizacao(); toast(x.ok ? 'Procurando atualização…' : x.motivo); }
}

// ---------- Inicialização ----------
async function iniciar() {
  const ini = await window.api.estadoInicial();
  E.perfis = ini.perfis; E.config = ini.config; E.estado = ini.estado; aplicarTema(ini.config.tema);
  if (!ini.dependencias.openvpn || !ini.dependencias.pkexec) {
    const falta = [!ini.dependencias.openvpn && 'openvpn', !ini.dependencias.pkexec && 'polkit (pkexec)'].filter(Boolean).join(' e ');
    $('rodape').textContent = `Falta instalar: ${falta}. Ex.: sudo apt install openvpn policykit-1`; $('rodape').className = 'aviso';
  }
  desenhar();

  window.api.aoToast((m) => toast(m));
  window.api.aoEstado((e) => {
    const anterior = E.estado.estado; E.estado = e;
    if (e.ipLocal) E.ipLocal = e.ipLocal; if (e.ipRemoto) E.ipRemoto = e.ipRemoto;
    if (e.estado === 'conectado' && anterior !== 'conectado') E.desde = Date.now();
    if (e.estado === 'conectando' && !ATIVOS.includes(anterior)) { E.desde = null; E.ipLocal = ''; E.ipRemoto = ''; }
    if (e.estado === 'erro') { E.erro = e.mensagem || 'Falha na conexão.'; E.selecionado = e.perfilId || E.selecionado; }
    if (e.estado === 'desconectado') E.desde = null;
    desenhar();
  });
  window.api.aoPerfis((p) => { E.perfis = p; desenharLista(); });
  window.api.aoBytes((b) => { $('s-in').textContent = fmtBytes(b.entrada); $('s-out').textContent = fmtBytes(b.saida); });
  window.api.aoLog((l) => { const el = $('log'); el.textContent += `${new Date(l.ts * 1000).toLocaleTimeString()}  ${l.texto}\n`; el.scrollTop = el.scrollHeight; });
  setInterval(() => { if (E.desde && E.estado.estado === 'conectado') $('s-tempo').textContent = fmtTempo(Date.now() - E.desde); }, 1000);

  $('b-importar').onclick = $('b-importar2').onclick = importar;
  $('b-exportar').onclick = exportar;
  $('b-prefs').onclick = preferencias;
  $('b-conectar').onclick = alternarConexao;
  $('b-renomear').onclick = renomear; $('b-remover').onclick = remover;
  $('b-esquecer').onclick = async () => { E.perfis = await window.api.esquecerCredenciais(E.selecionado); desenhar(); toast('Credenciais esquecidas'); };
  $('c-senha').onkeydown = (e) => { if (e.key === 'Enter') alternarConexao(); };
  document.querySelectorAll('#tema button').forEach((b) => { b.onclick = async () => { aplicarTema(b.dataset.tema); await window.api.setConfig({ tema: b.dataset.tema }); }; });
}
iniciar();
