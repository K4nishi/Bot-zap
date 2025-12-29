/**
 * Agendador para Tiragem de Falta
 * Envia uma enquete diária marcando todos os participantes do grupo
 * Às 7:15 envia o resultado da votação
 */

const cron = require('node-cron');
const { formatarData, getDiaSemana, getGruposAutorizados } = require('../utils/helpers');

// Armazena os votos da enquete do dia
// Formato: { visão GrupoID: { visão: [telefones], ausente: [telefones], atestado: [telefones], naoVotou: [telefones] } }
let votosDoDia = {};

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
        // Limpa os votos do dia anterior
        votosDoDia = {};
        ultimaEnquete = {};
        await enviarTiragemFalta(client);
    }, {
        scheduled: true,
        timezone: 'America/Sao_Paulo'
    });

    // Agenda o envio dos resultados às 7:15 (15 minutos depois)
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

    // Configura o listener para capturar votos
    configurarListenerVotos(client);
}

/**
 * Configura o listener para capturar votos da enquete
 * @param {Object} client - Cliente do WhatsApp
 */
function configurarListenerVotos(client) {
    client.on('poll_vote', async (vote) => {
        try {
            const chatId = vote.parentMessage?.from || vote.from;
            const voterId = vote.voter;
            const selectedOptions = vote.selectedOptions || [];

            console.log(`📥 Voto recebido de ${voterId}: ${selectedOptions.join(', ')}`);

            // Inicializa o objeto de votos do grupo se não existir
            if (!votosDoDia[chatId]) {
                votosDoDia[chatId] = {
                    presente: [],
                    ausente: [],
                    atestado: [],
                    participantes: []
                };
            }

            // Remove votos anteriores do mesmo usuário (caso mude o voto)
            votosDoDia[chatId].presente = votosDoDia[chatId].presente.filter(v => v !== voterId);
            votosDoDia[chatId].ausente = votosDoDia[chatId].ausente.filter(v => v !== voterId);
            votosDoDia[chatId].atestado = votosDoDia[chatId].atestado.filter(v => v !== voterId);

            // Adiciona o novo voto
            for (const option of selectedOptions) {
                if (option.name.includes('Presente')) {
                    votosDoDia[chatId].presente.push(voterId);
                } else if (option.name.includes('Ausente')) {
                    votosDoDia[chatId].ausente.push(voterId);
                } else if (option.name.includes('Atestado') || option.name.includes('Justificativa')) {
                    votosDoDia[chatId].atestado.push(voterId);
                }
            }

        } catch (error) {
            console.error('Erro ao processar voto:', error);
        }
    });

    console.log('👂 Listener de votos configurado!\n');
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
 * @param {Object} client - Cliente do WhatsApp
 * @param {Object} chat - Chat do grupo
 */
async function enviarResultadoGrupo(client, chat) {
    const chatId = chat.id._serialized;
    const dataAtual = formatarData();
    const votos = votosDoDia[chatId] || { presente: [], ausente: [], atestado: [] };

    // Conta os participantes do grupo
    const totalParticipantes = chat.participants.length;
    const totalVotaram = votos.presente.length + votos.ausente.length + votos.atestado.length;
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
        `✅ *PRESENTES (${votos.presente.length}):*\n${formatarNumeros(votos.presente)}\n\n` +
        `❌ *AUSENTES (${votos.ausente.length}):*\n${formatarNumeros(votos.ausente)}\n\n` +
        `🏥 *ATESTADO/JUSTIFICATIVA (${votos.atestado.length}):*\n${formatarNumeros(votos.atestado)}\n\n` +
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
            // Verifica se é um grupo
            if (!chat.isGroup) continue;

            // Verifica se está autorizado (se houver lista de autorizados)
            if (gruposAutorizados.length > 0 && !gruposAutorizados.includes(chat.id._serialized)) {
                continue;
            }

            try {
                // Inicializa os votos do grupo
                votosDoDia[chat.id._serialized] = {
                    presente: [],
                    ausente: [],
                    atestado: [],
                    participantes: chat.participants.map(p => p.id._serialized)
                };

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

    // Obtém todos os participantes para marcar
    // Usamos diretamente o ID serializado para evitar bugs do getContactById
    const participants = chat.participants;
    let mentions = [];
    let mentionText = '';

    for (const participant of participants) {
        // Adiciona o ID serializado diretamente (formato que funciona para menções)
        mentions.push(participant.id._serialized);
        // Extrai o número do telefone para mostrar na menção
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

    // Envia a mensagem marcando todos
    await chat.sendMessage(mensagemAviso, { mentions });

    // Aguarda um pouco antes de enviar a enquete
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
    } catch (pollError) {
        // Se a versão não suportar Poll, envia uma mensagem simples
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
 * @param {Object} client - Cliente do WhatsApp
 * @param {Object} chat - Chat do grupo
 */
async function tiragemFaltaManual(client, chat) {
    // Inicializa os votos do grupo
    votosDoDia[chat.id._serialized] = {
        presente: [],
        ausente: [],
        atestado: [],
        participantes: chat.participants.map(p => p.id._serialized)
    };
    await enviarEnqueteGrupo(client, chat);
}

/**
 * Função para ver resultado manual
 * @param {Object} client - Cliente do WhatsApp
 * @param {Object} chat - Chat do grupo
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
