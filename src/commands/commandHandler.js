/**
 * Handler de comandos do bot
 */

const { marcarTodos, isGrupoAutorizado, getPrefixo } = require('../utils/helpers');
const { tiragemFaltaManual, resultadoManual } = require('../schedulers/tiragemFalta');

/**
 * Processa os comandos recebidos
 * @param {Object} client - Cliente do WhatsApp
 * @param {Object} message - Mensagem recebida
 */
async function handleCommands(client, message) {
    const prefixo = getPrefixo();
    const body = message.body;

    // Verifica se é um comando
    if (!body.startsWith(prefixo)) {
        return;
    }

    // Obtém o chat
    const chat = await message.getChat();

    // Identifica se a mensagem é do dono (seu número)
    const senderId = message.author || message.from;
    console.log(`📩 Mensagem recebida de: ${senderId} | Comando: ${body}`);

    const isDono = message.fromMe || senderId.includes('5571991533200') || senderId.includes('557191533200');


    // Extrai o comando e os argumentos
    const args = body.slice(prefixo.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // Regras de Autorização:
    // 1. !grupoid sempre funciona (para poder configurar o bot)
    // 2. O seu número (Dono) sempre pode usar comandos
    // 3. Outros usuários só podem usar em grupos autorizados
    if (command !== 'grupoid' && !isDono) {
        if (!chat.isGroup) {
            await message.reply('❌ Este comando só funciona em grupos!');
            return;
        }

        if (!isGrupoAutorizado(chat.id._serialized)) {
            // Ignora silenciosamente para não floodar grupos aleatórios
            console.log(`🚫 Bloqueado comando ${command} no grupo não autorizado: ${chat.name}`);
            return;
        }
    }

    switch (command) {
        case 'aviso':
            await comandoAviso(client, message, chat, args);
            break;

        case 'grupoid':
            await comandoGrupoId(message, chat);
            break;

        case 'help':
        case 'ajuda':
        case 'comandos':
            await comandoHelp(message);
            break;

        case 'teste':
            await comandoTeste(message);
            break;

        case 'tiragem':
            await comandoTiragem(client, message, chat);
            break;

        case 'resultado':
            await comandoResultado(client, message, chat);
            break;

        default:
            // Comando não reconhecido - não responde nada
            break;
    }
}

/**
 * Comando !aviso - Marca todos do grupo com um aviso
 */
async function comandoAviso(client, message, chat, args) {
    // Verifica se há uma mensagem de aviso
    if (args.length === 0) {
        await message.reply(
            '❌ *Uso incorreto!*\n\n' +
            '📝 *Como usar:*\n' +
            '`!aviso [sua mensagem]`\n\n' +
            '📌 *Exemplo:*\n' +
            '`!aviso Reunião amanhã às 14h!`'
        );
        return;
    }

    const mensagemAviso = args.join(' ');

    try {
        // Obtém todos os participantes do grupo
        // Usamos diretamente o ID serializado para evitar bugs do getContactById
        const participants = chat.participants;
        let mentions = [];
        let mentionText = '';

        for (const participant of participants) {
            // Adiciona o ID serializado diretamente
            mentions.push(participant.id._serialized);
            mentionText += `@${participant.id.user} `;
        }

        // Monta a mensagem com o aviso
        const textoFinal =
            '🚨 *AVISO IMPORTANTE* 🚨\n\n' +
            `📢 ${mensagemAviso}\n\n` +
            '━━━━━━━━━━━━━━━━━━━━━\n' +
            '👥 *Atenção todos:*\n' +
            mentionText;

        // Envia a mensagem marcando todos
        await chat.sendMessage(textoFinal, { mentions });

        console.log(`✅ Aviso enviado no grupo: ${chat.name}`);

    } catch (error) {
        console.error('Erro ao enviar aviso:', error);
        await message.reply('❌ Ocorreu um erro ao enviar o aviso. Tente novamente.');
    }
}

/**
 * Comando !grupoid - Mostra o ID do grupo
 */
async function comandoGrupoId(message, chat) {
    const grupoId = chat.id._serialized;
    const grupoNome = chat.name;

    await message.reply(
        '📋 *Informações do Grupo*\n\n' +
        `📛 *Nome:* ${grupoNome}\n` +
        `🆔 *ID:* \`${grupoId}\`\n\n` +
        '💡 *Dica:* Copie este ID e cole no arquivo `.env` na variável `GRUPOS_AUTORIZADOS` para autorizar apenas grupos específicos.'
    );
}

/**
 * Comando !help - Mostra os comandos disponíveis
 */
async function comandoHelp(message) {
    const prefixo = getPrefixo();

    const helpMessage =
        '🤖 *BOT DE AVISOS - COMANDOS* 🤖\n\n' +
        '━━━━━━━━━━━━━━━━━━━━━\n\n' +
        `📢 *${prefixo}aviso [mensagem]*\n` +
        '   Envia um aviso marcando todos do grupo\n\n' +
        `📊 *${prefixo}tiragem*\n` +
        '   Envia a tiragem de falta manualmente\n\n' +
        `📋 *${prefixo}resultado*\n` +
        '   Mostra o resultado da tiragem atual\n\n' +
        `🆔 *${prefixo}grupoid*\n` +
        '   Mostra o ID do grupo atual\n\n' +
        `❓ *${prefixo}help*\n` +
        '   Mostra esta mensagem de ajuda\n\n' +
        `🧪 *${prefixo}teste*\n` +
        '   Testa se o bot está funcionando\n\n' +
        '━━━━━━━━━━━━━━━━━━━━━\n\n' +
        '⏰ *Tiragem de Falta Automática*\n' +
        '   • 07:00 - Envia a enquete de falta\n' +
        '   • 07:15 - Envia o resultado automático';

    await message.reply(helpMessage);
}

/**
 * Comando !teste - Verifica se o bot está funcionando
 */
async function comandoTeste(message) {
    await message.reply(
        '✅ *Bot está funcionando!*\n\n' +
        '🟢 Status: Online\n' +
        `⏰ Horário atual: ${new Date().toLocaleTimeString('pt-BR')}\n` +
        `📅 Data: ${new Date().toLocaleDateString('pt-BR')}`
    );
}

/**
 * Comando !tiragem - Executa a tiragem de falta manualmente
 */
async function comandoTiragem(client, message, chat) {
    try {
        await message.reply('📊 Enviando tiragem de falta...');
        await tiragemFaltaManual(client, chat);
        console.log(`✅ Tiragem manual enviada no grupo: ${chat.name}`);
    } catch (error) {
        console.error('Erro ao enviar tiragem:', error);
        await message.reply('❌ Ocorreu um erro ao enviar a tiragem. Tente novamente.');
    }
}

/**
 * Comando !resultado - Mostra o resultado da tiragem atual
 */
async function comandoResultado(client, message, chat) {
    try {
        await message.reply('📋 Gerando resultado da tiragem...');
        await resultadoManual(client, chat);
        console.log(`✅ Resultado enviado no grupo: ${chat.name}`);
    } catch (error) {
        console.error('Erro ao enviar resultado:', error);
        await message.reply('❌ Ocorreu um erro ao gerar o resultado. Tente novamente.');
    }
}

module.exports = {
    handleCommands
};

