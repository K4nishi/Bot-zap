/**
 * Agendador para Tiragem de Falta
 * Envia uma enquete diária marcando todos os participantes do grupo
 */

const cron = require('node-cron');
const { formatarData, getDiaSemana, getGruposAutorizados } = require('../utils/helpers');

/**
 * Agenda o envio da tiragem de falta
 * @param {Object} client - Cliente do WhatsApp
 */
function agendarTiragemFalta(client) {
    const hora = process.env.TIRAGEM_HORA || '08';
    const minuto = process.env.TIRAGEM_MINUTO || '00';

    // Expressão cron: minuto hora * * 1-5 (segunda a sexta)
    // Para todos os dias: minuto hora * * *
    const cronExpression = `${minuto} ${hora} * * 1-5`; // Segunda a Sexta

    console.log(`\n⏰ Tiragem de falta agendada para: ${hora}:${minuto} (Segunda a Sexta)`);
    console.log(`   Expressão cron: ${cronExpression}\n`);

    cron.schedule(cronExpression, async () => {
        console.log(`\n📊 Executando tiragem de falta - ${formatarData()}\n`);
        await enviarTiragemFalta(client);
    }, {
        scheduled: true,
        timezone: 'America/Sao_Paulo'
    });
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
        '👇 Responda a enquete abaixo:\n\n' +
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

        await chat.sendMessage(poll);
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
    await enviarEnqueteGrupo(client, chat);
}

module.exports = {
    agendarTiragemFalta,
    enviarTiragemFalta,
    tiragemFaltaManual
};
