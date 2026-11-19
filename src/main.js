'use strict';
const { app, BrowserWindow, Tray, Menu, ipcMain, dialog, nativeImage, nativeTheme, shell } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Store } = require('./store');
const { Conexao } = require('./openvpn');
const autostart = require('./autostart');
const { migrarDadosAntigos } = require('./migracao');
const { criarAtualizador } = require('./atualizador');

app.setName('PostigoVPN');
// Identidade única da janela: nome do .desktop = StartupWMClass = app_id (sem isso o ícone vira genérico).
if (process.platform === 'linux') app.setDesktopName('postigovpn.desktop');
if (!app.requestSingleInstanceLock()) { app.quit(); }

const ICONE = path.join(__dirname, '..', 'assets', 'icone.png');
let janela = null, bandeja = null, store = null, saindo = false, atualizador = null;
const conexao = new Conexao();
let ultimoEstado = { estado: 'desconectado', perfilId: null };

function enviar(canal, dado) { if (janela && !janela.isDestroyed()) janela.webContents.send(canal, dado); }

function criarJanela() {
  const tema = store.getConfig().tema;
  nativeTheme.themeSource = tema === 'claro' ? 'light' : tema === 'escuro' ? 'dark' : 'system';
  janela = new BrowserWindow({
    width: 980, height: 720, minWidth: 760, minHeight: 540, show: false,
    title: 'PostigoVPN', icon: ICONE, autoHideMenuBar: true,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0c0d12' : '#eef0f7',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  janela.setMenu(null);
  janela.loadFile(path.join(__dirname, '..', 'ui', 'index.html'));
  janela.once('ready-to-show', () => { if (!process.argv.includes('--oculto')) janela.show(); });
  janela.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  janela.webContents.on('will-navigate', (e) => e.preventDefault());
  janela.on('close', (e) => {
    if (!saindo && store.getConfig().minimizarParaBandeja && bandeja) { e.preventDefault(); janela.hide(); }
  });
}

function mostrar() { if (!janela) return; janela.show(); janela.focus(); }

function menuBandeja() {
  const ativo = ['conectado', 'conectando', 'autenticando', 'reconectando'].includes(ultimoEstado.estado);
  const perfis = store.listar();
  return Menu.buildFromTemplate([
    { label: 'Abrir PostigoVPN', click: mostrar },
    { type: 'separator' },
    ...(ativo ? [{ label: 'Desconectar', click: () => conexao.desconectar() }]
      : perfis.length ? perfis.map((p) => ({ label: `Conectar: ${p.nome}`, enabled: !p.exigeCredenciais || p.temCredenciais, click: () => conectar(p.id) }))
      : [{ label: 'Nenhuma conexão importada', enabled: false }]),
    { type: 'separator' },
    { label: 'Buscar atualização', click: () => atualizador && atualizador.verificar({ pedido: true }) },
    { label: 'Sair', click: () => { saindo = true; conexao.desconectar(); setTimeout(() => app.quit(), conexao.filho ? 1500 : 0); } },
  ]);
}

function criarBandeja() {
  try {
    bandeja = new Tray(nativeImage.createFromPath(ICONE).resize({ width: 22, height: 22 }));
    bandeja.setToolTip('PostigoVPN');
    bandeja.on('click', () => (janela && janela.isVisible() ? janela.hide() : mostrar()));
    bandeja.setContextMenu(menuBandeja());
  } catch { bandeja = null; }
}

function atualizarBandeja() {
  if (!bandeja) return;
  const rot = { conectado: 'Conectado', conectando: 'Conectando…', autenticando: 'Autenticando…', reconectando: 'Reconectando…', desconectado: 'Desconectado', erro: 'Erro', desconectando: 'Desconectando…' };
  bandeja.setToolTip(`PostigoVPN — ${rot[ultimoEstado.estado] || ''}`);
  bandeja.setContextMenu(menuBandeja());
}

async function conectar(id, extra = {}) {
  const perfil = store.obter(id);
  if (!perfil) throw new Error('Perfil não encontrado.');
  let credenciais = null;
  if (perfil.exigeCredenciais) {
    if (extra.usuario) {
      credenciais = { usuario: extra.usuario, senha: extra.senha || '' };
      if (extra.lembrar) store.salvarCredenciais(id, credenciais.usuario, credenciais.senha);
    } else credenciais = store.obterCredenciais(id);
    if (!credenciais) throw new Error('Informe usuário e senha.');
  }
  enviar('perfis', store.listar());
  await conexao.conectar({ perfilId: id, caminhoOvpn: store.caminho(id), credenciais });
}

function registrarIpc() {
  ipcMain.handle('estado-inicial', () => ({
    perfis: store.listar(), config: store.getConfig(), estado: ultimoEstado,
    dependencias: conexao.dependencias(), versao: app.getVersion(),
  }));

  ipcMain.handle('importar-arquivos', async () => {
    const r = await dialog.showOpenDialog(janela, {
      title: 'Importar conexões', properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Perfis OpenVPN e pacotes', extensions: ['ovpn', 'conf', 'json'] }],
    });
    if (r.canceled) return { importadas: [], ignoradas: [], perfis: store.listar() };
    const total = { importadas: [], ignoradas: [] };
    for (const f of r.filePaths) {
      try {
        const x = store.importarPacoteOuArquivo(f);
        total.importadas.push(...x.importadas); total.ignoradas.push(...x.ignoradas);
      } catch (e) { total.ignoradas.push({ nome: path.basename(f), motivo: e.message }); }
    }
    total.perfis = store.listar();
    return total;
  });

  ipcMain.handle('exportar-conexoes', async (_e, incluirCredenciais) => {
    if (!store.listar().length) return { ok: false, motivo: 'Não há conexões para exportar.' };
    const data = new Date().toISOString().slice(0, 10);
    const r = await dialog.showSaveDialog(janela, {
      title: 'Exportar conexões', defaultPath: path.join(os.homedir(), `conexoes-postigovpn-${data}.json`),
      filters: [{ name: 'Conexões PostigoVPN', extensions: ['json'] }],
    });
    if (r.canceled || !r.filePath) return { ok: false, cancelado: true };
    fs.writeFileSync(r.filePath, JSON.stringify(store.exportar({ incluirCredenciais: Boolean(incluirCredenciais) }), null, 2), { mode: 0o600 });
    return { ok: true, arquivo: r.filePath, total: store.listar().length };
  });

  ipcMain.handle('renomear', (_e, id, nome) => { store.renomear(id, nome); atualizarBandeja(); return store.listar(); });
  ipcMain.handle('remover', (_e, id) => {
    if (conexao.perfilId === id && conexao.filho) throw new Error('Desconecte antes de remover este perfil.');
    store.remover(id); atualizarBandeja(); return store.listar();
  });
  ipcMain.handle('esquecer-credenciais', (_e, id) => { store.esquecerCredenciais(id); return store.listar(); });
  ipcMain.handle('conectar', async (_e, { id, usuario, senha, lembrar }) => {
    try { await conectar(id, { usuario, senha, lembrar }); return { ok: true }; }
    catch (e) { return { ok: false, motivo: e.message }; }
  });
  ipcMain.handle('desconectar', () => { conexao.desconectar(); return true; });
  ipcMain.handle('prefs', () => ({ config: store.getConfig(), iniciarComSistema: autostart.estaAtivo(), versao: app.getVersion(), empacotado: app.isPackaged }));
  ipcMain.handle('set-iniciar-com-sistema', (_e, ligar) => {
    if (ligar) autostart.ativar(); else autostart.desativar();
    return autostart.estaAtivo();
  });
  ipcMain.handle('buscar-atualizacao', () => {
    if (!atualizador) return { ok: false, motivo: 'Atualização automática só funciona no app instalado (AppImage, deb ou rpm).' };
    atualizador.verificar({ pedido: true }); return { ok: true };
  });
  ipcMain.handle('set-config', (_e, c) => {
    const nova = store.setConfig(c);
    if (c.tema) nativeTheme.themeSource = c.tema === 'claro' ? 'light' : c.tema === 'escuro' ? 'dark' : 'system';
    return nova;
  });
}

app.whenReady().then(() => {
  // Traz conexões, senhas e preferências das versões anteriores (pastas de dados antigas), se existirem, antes de abrir o armazenamento.
  const dados = app.getPath('userData');
  const antigoDe = migrarDadosAntigos(dados, [path.join(app.getPath('appData'), 'OpenVPN Connect'), path.join(app.getPath('appData'), 'openvpn-connect')]);
  if (antigoDe) console.warn('[migração] dados trazidos de', antigoDe);
  store = new Store(dados);
  registrarIpc();
  criarJanela();
  criarBandeja();
  autostart.migrarAntigo();
  autostart.sincronizar();
  if (app.isPackaged) {
    try {
      const { autoUpdater } = require('electron-updater');
      atualizador = criarAtualizador({
        autoUpdater, dialog, janela: () => janela,
        antesDeSair: () => { saindo = true; conexao.desconectar(); },
        aviso: () => (conexao.filho ? 'A VPN conectada será desconectada durante a atualização.' : ''),
        ativo: () => store.getConfig().atualizacaoAutomatica !== false,
        log: (...a) => console.warn('[atualizador]', ...a),
      });
      setTimeout(() => atualizador.iniciar(), 10000);
    } catch (e) { console.warn('[atualizador] indisponível:', e.message); }
  }
  conexao.on('estado', (e) => { ultimoEstado = e; enviar('estado', e); atualizarBandeja(); if (e.estado === 'erro' || e.estado === 'desconectado') enviar('perfis', store.listar()); });
  conexao.on('log', (l) => enviar('log', l));
  conexao.on('bytes', (b) => enviar('bytes', b));
});
app.on('second-instance', mostrar);
app.on('before-quit', () => { saindo = true; });
app.on('window-all-closed', () => { if (!bandeja) app.quit(); });
