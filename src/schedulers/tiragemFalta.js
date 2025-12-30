/**
 * Agendador para Tiragem de Falta
 * Envia uma mensagem diária pedindo reações para marcar presença
 * Envia o resultado automaticamente 15 minutos depois
 */

const cron = require('node-cron');
const { formatarData, getDiaSemana, getGrupoTiragem } = require('../utils/helpers');

// Armazena o ID da última mensagem de tiragem enviada por grupo
let ultimaMensagemTiragem = {};

/**
 * Agenda o envio da tiragem de falta e seu resultado
 * @param {Object} client - Cliente do WhatsApp
 */
function agendarTiragemFalta(client) {
    const hora = process.env.TIRAGEM_HORA || '07';
    const minuto = process.env.TIRAGEM_MINUTO || '00';

    // Expressão cron para tiragem: minuto hora * * 1-5 (segunda a sexta)
    const cronExpression = `${minuto} ${hora} * * 1-5`;

    console.log(`\n⏰ Tiragem de falta agendada para: ${hora}:${minuto} (Segunda a Sexta)`);

    cron.schedule(cronExpression, async () => {
        console.log(`\n📊 Executando tiragem de falta automática - ${formatarData()}\n`);

        const idGrupo = getGrupoTiragem();
        if (!idGrupo) {
            console.log('⚠️ ID_GRUPO_TIRAGEM não configurado no .env. Ignorando tiragem automática.');
            return;
        }

        try {
            const chat = await client.getChatById(idGrupo);
            await enviarEnqueteGrupo(client, chat);
            console.log(`✅ Tiragem automática enviada para grupo: ${chat.name}`);
        } catch (error) {
            console.error('❌ Erro na tiragem automática:', error.message);
        }
    }, {
        scheduled: true,
        timezone: 'America/Sao_Paulo'
    });

    // Agenda o envio dos resultados 15 minutos depois
    const minutoResultado = (parseInt(minuto) + 15) % 60;
    const horaResultado = minutoResultado < parseInt(minuto) ? (parseInt(hora) + 1) % 24 : hora;
    const cronResultado = `${minutoResultado} ${horaResultado} * * 1-5`;

    console.log(`📊 Resultado da tiragem agendado para: ${horaResultado.toString().padStart(2, '0')}:${minutoResultado.toString().padStart(2, '0')}\n`);

    cron.schedule(cronResultado, async () => {
        console.log(`\n📋 Enviando resultado da tiragem automático - ${formatarData()}\n`);

        const idGrupo = getGrupoTiragem();
        if (!idGrupo) return;

        try {
            const chat = await client.getChatById(idGrupo);
            await enviarResultadoGrupo(client, chat);
            console.log(`✅ Resultado automático enviado para grupo: ${chat.name}`);
        } catch (error) {
            console.error('❌ Erro no resultado automático:', error.message);
        }
    }, {
        scheduled: true,
        timezone: 'America/Sao_Paulo'
    });
}

/**
 * Envia o resultado da tiragem para um grupo
 * Lógica: Presentes = quem reagiu com ✅. Ausentes = Todos os outros participantes.
 * @param {Object} client - Cliente do WhatsApp
 * @param {Object} chat - Chat do grupo
 */
async function enviarResultadoGrupo(client, chat) {
    const chatId = chat.id._serialized;
    const dataAtual = formatarData();
    const botId = client.info.wid._serialized;

    let presentesIds = new Set();
    let msgIdMemory = ultimaMensagemTiragem[chatId];
    let msgTiragem = null;

    try {
        const messages = await chat.fetchMessages({ limit: 50 });

        if (msgIdMemory) {
            msgTiragem = messages.find(m => m.id._serialized === msgIdMemory);
        }

        if (!msgTiragem) {
            console.log('🔍 Buscando mensagem de tiragem por conteúdo...');
            msgTiragem = messages.find(m =>
                m.fromMe &&
                m.body &&
                m.body.includes('📋 *TIRAGEM DE FALTA* 📋') &&
                m.body.includes(dataAtual)
            );
            if (msgTiragem) {
                ultimaMensagemTiragem[chatId] = msgTiragem.id._serialized;
                console.log('✅ Mensagem de tiragem encontrada no histórico.');
            }
        }

        if (msgTiragem && msgTiragem.reactions && msgTiragem.reactions.length > 0) {
            console.log(`📊 Processando reações da mensagem: ${msgTiragem.id._serialized}`);
            for (const reaction of msgTiragem.reactions) {
                const emoji = reaction.aggregateEmoji.replace(/\uFE0F/g, '');
                if (emoji === '✅' || emoji === '✔️') {
                    const senders = reaction.senders || [];
                    for (const sender of senders) {
                        const sId = sender.id?._serialized || sender._serialized || sender;
                        presentesIds.add(sId);
                    }
                }
            }
        } else {
            console.log('⚠️ Nenhuma reação encontrada na mensagem de tiragem.');
        }
    } catch (error) {
        console.error('Erro ao buscar reações para resultado:', error.message);
    }

    // Calcula listas baseadas nos participantes do grupo
    const todosParticipantes = chat.participants;
    const listaPresentes = [];
    const listaAusentes = [];

    for (const participant of todosParticipantes) {
        const pId = participant.id._serialized;

        // Ignora o bot na contagem
        if (pId === botId) continue;

        if (presentesIds.has(pId)) {
            listaPresentes.push(pId);
        } else {
            listaAusentes.push(pId);
        }
    }

    const formatarLista = (lista) => {
        if (lista.length === 0) return '_Nenhum_';
        return lista.map(id => {
            const numero = id.split('@')[0];
            return `📱 ${numero}`;
        }).join('\n');
    };

    const mensagem =
        `📊 *RESULTADO DA TIRAGEM DE FALTA* 📊\n\n` +
        `📅 ${dataAtual}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `✅ *PRESENTES (${listaPresentes.length}):*\n${formatarLista(listaPresentes)}\n\n` +
        `❌ *AUSENTES (${listaAusentes.length}):*\n${formatarLista(listaAusentes)}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `📈 *RESUMO:* ${listaPresentes.length}/${todosParticipantes.length - 1} presentes`;

    await chat.sendMessage(mensagem);
}

/**
 * Envia a mensagem de tiragem para um grupo
 * @param {Object} client - Cliente do WhatsApp
 * @param {Object} chat - Chat do grupo
 */
async function enviarEnqueteGrupo(client, chat) {
    const dataAtual = formatarData();
    const diaSemana = getDiaSemana();
    const participants = chat.participants;
    const botId = client.info.wid._serialized;

    let mentions = [];
    let mentionText = '';

    for (const participant of participants) {
        if (participant.id._serialized === botId) continue;
        mentions.push(participant.id._serialized);
        mentionText += `@${participant.id.user} `;
    }

    const mensagemTiragem =
        '📋 *TIRAGEM DE FALTA* 📋\n\n' +
        `📅 *${diaSemana}* - ${dataAtual}\n\n` +
        'Reaja a esta mensagem para marcar sua presença:\n' +
        '✅ = *Presente*\n\n' +
        '⚠️ *Atenção:* Quem não reagir será marcado como *Ausente* ❌\n\n' +
        '━━━━━━━━━━━━━━━━━━━━━\n' +
        '👥 *Chamada:* \n' +
        mentionText;

    const sentMsg = await chat.sendMessage(mensagemTiragem, { mentions });
    ultimaMensagemTiragem[chat.id._serialized] = sentMsg.id._serialized;
}

/**
 * Funções para acionamento manual
 */
async function tiragemFaltaManual(client, chat) {
    await enviarEnqueteGrupo(client, chat);
}

async function resultadoManual(client, chat) {
    await enviarResultadoGrupo(client, chat);
}

module.exports = {
    agendarTiragemFalta,
    tiragemFaltaManual,
    resultadoManual
};
