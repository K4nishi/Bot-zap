/**
 * Agendador para Tiragem de Falta
 * Envia uma enquete diária marcando todos os participantes do grupo
 * Às 7:15 envia o resultado da votação
 */

const cron = require('node-cron');
const { formatarData, getDiaSemana, getGruposAutorizados } = require('../utils/helpers');

// Armazena o ID da última enquete enviada por grupo
let ultimaEnquete = {};

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
    console.log(`   Expressão cron: ${cronExpression}`);

    cron.schedule(cronExpression, async () => {
        console.log(`\n📊 Executando tiragem de falta - ${formatarData()}\n`);
        ultimaEnquete = {};
        await enviarTiragemFalta(client);
    }, {
        scheduled: true,
        timezone: 'America/Sao_Paulo'
    });

    // Agenda o envio dos resultados 15 minutos depois
    const horaResultado = hora;
    const minutoResultado = '15';
    const cronResultado = `${minutoResultado} ${horaResultado} * * 1-5`;

    console.log(`📊 Resultado da tiragem agendado para: ${horaResultado}:${minutoResultado}`);
    console.log(`   Expressão cron: ${cronResultado}\n`);

    cron.schedule(cronResultado, async () => {
        console.log(`\n📋 Enviando resultado da tiragem - ${formatarData()}\n`);
        await enviarResultadoTiragem(client);
    }, {
        scheduled: true,
        timezone: 'America/Sao_Paulo'
    });
}

/**
 * Envia o resultado da tiragem de falta
 * @param {Object} client - Cliente do WhatsApp
 */
async function enviarResultadoTiragem(client) {
    try {
        const chats = await client.getChats();
        const gruposAutorizados = getGruposAutorizados();

        for (const chat of chats) {
            if (!chat.isGroup) continue;

            if (gruposAutorizados.length > 0 && !gruposAutorizados.includes(chat.id._serialized)) {
                continue;
            }

            try {
                await enviarResultadoGrupo(client, chat);
                console.log(`✅ Resultado enviado para: ${chat.name}`);
            } catch (error) {
                console.error(`❌ Erro ao enviar resultado para ${chat.name}:`, error.message);
            }
        }
    } catch (error) {
        console.error('Erro ao enviar resultados:', error);
    }
}

/**
 * Envia o resultado da tiragem para um grupo específico
 * Busca os votos diretamente da última enquete enviada
 * @param {Object} client - Cliente do WhatsApp
 * @param {Object} chat - Chat do grupo
 */
async function enviarResultadoGrupo(client, chat) {
    const chatId = chat.id._serialized;
    const dataAtual = formatarData();

    // Busca a última enquete do chat
    const pollId = ultimaEnquete[chatId];

    let presentes = [];
    let ausentes = [];
    let atestados = [];

    if (pollId) {
        try {
            // Tenta buscar a mensagem da enquete
            const messages = await chat.fetchMessages({ limit: 50 });

            for (const msg of messages) {
                if (msg.type === 'poll_creation' && msg.fromMe) {
                    // Encontrou a enquete, tenta pegar os votos
                    try {
                        const pollVotes = await msg.getPollVotes();

                        if (pollVotes && pollVotes.length > 0) {
                            for (const voteData of pollVotes) {
                                const voterId = voteData.sender;
                                const selectedOption = voteData.selectedOptions?.[0]?.name || '';

                                if (selectedOption.includes('Presente')) {
                                    presentes.push(voterId);
                                } else if (selectedOption.includes('Ausente')) {
                                    ausentes.push(voterId);
                                } else if (selectedOption.includes('Atestado') || selectedOption.includes('Justificativa')) {
                                    atestados.push(voterId);
                                }
                            }
                        }
                    } catch (e) {
                        console.log('Não foi possível obter votos da enquete:', e.message);
                    }
                    break;
                }
            }
        } catch (error) {
            console.error('Erro ao buscar enquete:', error.message);
        }
    }

    // Conta os participantes do grupo
    const totalParticipantes = chat.participants.length;
    const totalVotaram = presentes.length + ausentes.length + atestados.length;
    const naoVotaram = totalParticipantes - totalVotaram;

    // Formata os números de telefone
    const formatarNumeros = (lista) => {
        if (lista.length === 0) return 'Nenhum';
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
        `✅ *PRESENTES (${presentes.length}):*\n${formatarNumeros(presentes)}\n\n` +
        `❌ *AUSENTES (${ausentes.length}):*\n${formatarNumeros(ausentes)}\n\n` +
        `🏥 *ATESTADO/JUSTIFICATIVA (${atestados.length}):*\n${formatarNumeros(atestados)}\n\n` +
        `⚠️ *NÃO VOTARAM (${naoVotaram}):*\n` +
        (naoVotaram > 0 ? `${naoVotaram} pessoa(s) não responderam` : 'Todos votaram! 🎉') +
        `\n\n━━━━━━━━━━━━━━━━━━━━━\n` +
        `📈 *RESUMO:* ${totalVotaram}/${totalParticipantes} votaram`;

    await chat.sendMessage(mensagem);
}

/**
 * Envia a enquete de tiragem de falta para todos os grupos autorizados
 * @param {Object} client - Cliente do WhatsApp
 */
async function enviarTiragemFalta(client) {
    try {
        const chats = await client.getChats();
        const gruposAutorizados = getGruposAutorizados();

        for (const chat of chats) {
            if (!chat.isGroup) continue;

            if (gruposAutorizados.length > 0 && !gruposAutorizados.includes(chat.id._serialized)) {
                continue;
            }

            try {
                await enviarEnqueteGrupo(client, chat);
                console.log(`✅ Tiragem enviada para: ${chat.name}`);
            } catch (error) {
                console.error(`❌ Erro ao enviar para ${chat.name}:`, error.message);
            }
        }
    } catch (error) {
        console.error('Erro ao executar tiragem de falta:', error);
    }
}

/**
 * Envia a enquete de tiragem para um grupo específico
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

    // Mensagem de aviso antes da enquete
    const mensagemAviso =
        '📋 *TIRAGEM DE FALTA* 📋\n\n' +
        `📅 *${diaSemana}* - ${dataAtual}\n\n` +
        '👇 Responda a enquete abaixo:\n' +
        '⏰ Você tem até 07:15 para votar!\n\n' +
        '━━━━━━━━━━━━━━━━━━━━━\n' +
        '👥 *Atenção todos:*\n' +
        mentionText;

    await chat.sendMessage(mensagemAviso, { mentions });
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Cria e envia a enquete
    try {
        const { Poll } = require('whatsapp-web.js');
        const poll = new Poll(
            `📊 Tiragem de Falta - ${dataAtual}`,
            [
                '✅ Presente',
                '❌ Ausente',
                '🏥 Atestado/Justificativa'
            ],
            {
                allowMultipleAnswers: false
            }
        );

        const sentPoll = await chat.sendMessage(poll);
        ultimaEnquete[chat.id._serialized] = sentPoll.id._serialized;
        console.log(`📊 Enquete salva: ${sentPoll.id._serialized}`);
    } catch (pollError) {
        console.log('⚠️ Enquete não suportada, enviando mensagem alternativa...');

        const mensagemAlternativa =
            `📊 *Tiragem de Falta - ${dataAtual}*\n\n` +
            'Reaja a esta mensagem:\n\n' +
            '✅ = Presente\n' +
            '❌ = Ausente\n' +
            '🏥 = Atestado/Justificativa';

        await chat.sendMessage(mensagemAlternativa);
    }
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
    enviarTiragemFalta,
    tiragemFaltaManual,
    resultadoManual
};
