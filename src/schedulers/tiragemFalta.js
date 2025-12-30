/**
 * Agendador para Tiragem de Falta
 * Envia uma mensagem diária pedindo reações para marcar presença
 * Às 07:15 envia o resultado da votação
 */

const cron = require('node-cron');
const { formatarData, getDiaSemana, getGruposAutorizados, getGrupoTiragem } = require('../utils/helpers');

// Armazena o ID da última mensagem de tiragem enviada por grupo
let ultimaMensagemTiragem = {};

/**
 * Agenda o envio da tiragem de falta
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
    const horaResultado = hora;
    const minutoResultado = '15';
    const cronResultado = `${minutoResultado} ${horaResultado} * * 1-5`;

    console.log(`📊 Resultado da tiragem agendado para: ${horaResultado}:${minutoResultado}\n`);

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
 * Envia o resultado da tiragem para um grupo específico
 * @param {Object} client - Cliente do WhatsApp
 * @param {Object} chat - Chat do grupo
 */
async function enviarResultadoGrupo(client, chat) {
    const chatId = chat.id._serialized;
    const dataAtual = formatarData();

    // Busca a última mensagem de tiragem do chat
    const msgId = ultimaMensagemTiragem[chatId];

    let presentes = new Set();
    let ausentes = new Set();
    let atestados = new Set();

    if (msgId) {
        try {
            // Busca a mensagem específica para pegar as reações atualizadas
            const messages = await chat.fetchMessages({ limit: 50 });
            const msgTiragem = messages.find(m => m.id._serialized === msgId);

            if (msgTiragem && msgTiragem.reactions) {
                // Em whatsapp-web.js as reações costumam vir em um array
                // Cada item tem aggregateEmoji e senders
                for (const reaction of msgTiragem.reactions) {
                    const emoji = reaction.aggregateEmoji;
                    const senders = reaction.senders || [];

                    for (const sender of senders) {
                        const senderId = sender.id?._serialized || sender._serialized;

                        if (emoji === '✅') {
                            presentes.add(senderId);
                        } else if (emoji === '❌') {
                            ausentes.add(senderId);
                        } else if (emoji === '🏥') {
                            atestados.add(senderId);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Erro ao buscar reações:', error.message);
        }
    }

    const listaPresentes = Array.from(presentes);
    const listaAusentes = Array.from(ausentes);
    const listaAtestados = Array.from(atestados);

    // Conta os participantes do grupo
    const totalParticipantes = chat.participants.length;
    const todosVotantes = new Set([...listaPresentes, ...listaAusentes, ...listaAtestados]);
    const totalVotaram = todosVotantes.size;
    const naoVotaram = totalParticipantes - totalVotaram;

    // Formata os números de telefone
    const formatarNumeros = (lista) => {
        if (lista.length === 0) return '_Nenhum_';
        return lista.map(id => {
            const numero = id.split('@')[0];
            return `📱 ${numero}`;
        }).join('\n');
    };

    // Monta a mensagem de resultado
    const mensagem =
        `📊 *RESULTADO DA TIRAGEM DE FALTA* 📊\n\n` +
        `📅 ${dataAtual}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `✅ *PRESENTES (${listaPresentes.length}):*\n${formatarNumeros(listaPresentes)}\n\n` +
        `❌ *AUSENTES (${listaAusentes.length}):*\n${formatarNumeros(listaAusentes)}\n\n` +
        `🏥 *ATESTADO (${listaAtestados.length}):*\n${formatarNumeros(listaAtestados)}\n\n` +
        `⚠️ *NÃO VOTARAM (${naoVotaram}):*\n` +
        (naoVotaram > 0 ? `${naoVotaram} pessoa(s) não reagiram` : 'Todos reagiram! 🎉') +
        `\n\n━━━━━━━━━━━━━━━━━━━━━\n` +
        `📈 *RESUMO:* ${totalVotaram}/${totalParticipantes} participaram`;

    await chat.sendMessage(mensagem);
}

/**
 * Envia a mensagem de tiragem para um grupo específico usando emojis/reações
 * @param {Object} client - Cliente do WhatsApp
 * @param {Object} chat - Chat do grupo
 */
async function enviarEnqueteGrupo(client, chat) {
    const dataAtual = formatarData();
    const diaSemana = getDiaSemana();

    const participants = chat.participants;
    let mentions = [];
    let mentionText = '';

    for (const participant of participants) {
        mentions.push(participant.id._serialized);
        mentionText += `@${participant.id.user} `;
    }

    // Mensagem de aviso e instruções
    const mensagemTiragem =
        '📋 *TIRAGEM DE FALTA* 📋\n\n' +
        `📅 *${diaSemana}* - ${dataAtual}\n\n` +
        'Reaja a esta mensagem para marcar sua presença:\n' +
        '✅ = *Presente*\n' +
        '❌ = *Ausente*\n' +
        '🏥 = *Atestado/Justificativa*\n\n' +
        '⏰ Você tem até 07:15 para reagir!\n\n' +
        '━━━━━━━━━━━━━━━━━━━━━\n' +
        '👥 *Atenção todos:*\n' +
        mentionText;

    const sentMsg = await chat.sendMessage(mensagemTiragem, { mentions });

    // Armazena o ID para buscar o resultado depois
    ultimaMensagemTiragem[chat.id._serialized] = sentMsg.id._serialized;
}

/**
 * Função para teste manual da tiragem de falta
 */
async function tiragemFaltaManual(client, chat) {
    await enviarEnqueteGrupo(client, chat);
}

/**
 * Função para ver resultado manual
 */
async function resultadoManual(client, chat) {
    await enviarResultadoGrupo(client, chat);
}

module.exports = {
    agendarTiragemFalta,
    tiragemFaltaManual,
    resultadoManual
};
