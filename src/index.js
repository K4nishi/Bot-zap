/**
 * Bot de WhatsApp - Avisos e Tiragem de Falta
 * 
 * Este bot oferece as seguintes funcionalidades:
 * - !aviso [mensagem]: Marca todos do grupo com uma mensagem de aviso
 * - Tiragem de falta automática: Envia enquete diária marcando todos
 * - !grupoid: Mostra o ID do grupo atual
 * - !help: Mostra os comandos disponíveis
 */

const { Client, LocalAuth, Poll } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const cron = require('node-cron');
const path = require('path');
require('dotenv').config();

const { marcarTodos, formatarData, getGruposAutorizados } = require('./utils/helpers');
const { handleCommands } = require('./commands/commandHandler');
const { agendarTiragemFalta } = require('./schedulers/tiragemFalta');

// Caminho absoluto para salvar a sessão (garante persistência)
const SESSION_PATH = path.join(__dirname, '..', '.wwebjs_auth');

console.log(`📁 Sessão será salva em: ${SESSION_PATH}`);

// Criação do cliente WhatsApp
const client = new Client({
    authStrategy: new LocalAuth({
        clientId: 'bot-whatsapp',  // ID único para identificar a sessão
        dataPath: SESSION_PATH      // Caminho absoluto
    }),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
        ]
    },
    webVersionCache: {
        type: 'remote',
        remotePath: 'https://raw.githubusercontent.com/AurimasJa/whatsapp-web.js/main/src/util/Constants.js'
    }
});

// Evento: QR Code gerado
client.on('qr', (qr) => {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║        ESCANEIE O QR CODE COM SEU WHATSAPP                  ║');
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log('║  1. Abra o WhatsApp no seu celular                         ║');
    console.log('║  2. Toque em Menu (⋮) ou Configurações                     ║');
    console.log('║  3. Toque em "Aparelhos conectados"                        ║');
    console.log('║  4. Toque em "Conectar um aparelho"                        ║');
    console.log('║  5. Escaneie este código QR                                ║');
    console.log('║                                                            ║');
    console.log('║  💾 Após escanear, sua sessão será SALVA automaticamente!  ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    qrcode.generate(qr, { small: true });
});

// Evento: Cliente pronto
client.on('ready', () => {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║           🤖 BOT DO WHATSAPP CONECTADO! 🤖                  ║');
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log('║  ✅ Bot está online e funcionando!                         ║');
    console.log('║  💾 Sessão salva! Não precisará escanear QR novamente.     ║');
    console.log('║  📋 Comandos disponíveis:                                  ║');
    console.log('║     • !aviso [mensagem] - Marca todos com um aviso         ║');
    console.log('║     • !grupoid - Mostra o ID do grupo                      ║');
    console.log('║     • !help - Lista de comandos                            ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    // Agenda a tiragem de falta
    agendarTiragemFalta(client);
});

// Evento: Mensagem recebida (de terceiros)
client.on('message', async (message) => {
    try {
        await handleCommands(client, message);
    } catch (error) {
        console.error('Erro ao processar mensagem:', error);
    }
});

// Evento: Mensagem criada (inclui as enviadas pelo próprio bot/conta)
client.on('message_create', async (message) => {
    // Processa apenas se começar com o prefixo para evitar loop de mensagens do próprio bot
    if (message.body.startsWith(getPrefixo())) {
        try {
            await handleCommands(client, message);
        } catch (error) {
            console.error('Erro ao processar mensagem criada:', error);
        }
    }
});

// Evento: Autenticação bem-sucedida
client.on('authenticated', () => {
    console.log('✅ Autenticação bem-sucedida! Sessão salva.');
});

// Evento: Falha na autenticação
client.on('auth_failure', (msg) => {
    console.error('❌ Falha na autenticação:', msg);
    console.log('💡 Dica: Delete a pasta .wwebjs_auth e tente novamente.');
});

// Evento: Desconectado
client.on('disconnected', (reason) => {
    console.log('⚠️ Bot desconectado:', reason);
    console.log('🔄 Tentando reconectar...');
    client.initialize();
});

// Tratamento de erros não capturados
process.on('unhandledRejection', (error) => {
    console.error('Erro não tratado:', error);
});

// Tratamento de saída do programa (Ctrl+C)
// Garante que a sessão seja salva antes de fechar
process.on('SIGINT', async () => {
    console.log('\n\n⏳ Encerrando bot de forma segura...');
    console.log('💾 Salvando sessão...');

    try {
        await client.destroy();
        console.log('✅ Sessão salva com sucesso!');
        console.log('👋 Bot encerrado. Até a próxima!\n');
    } catch (error) {
        console.error('Erro ao encerrar:', error);
    }

    process.exit(0);
});

// Inicialização do cliente
console.log('\n🚀 Iniciando Bot do WhatsApp...\n');
client.initialize();
