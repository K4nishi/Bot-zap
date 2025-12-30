/**
 * Funções auxiliares para o bot
 */

/**
 * Marca todos os participantes de um grupo
 * @param {Object} chat - O chat do grupo
 * @returns {Promise<string>} - String com todas as menções
 */
async function marcarTodos(chat) {
    const participants = await chat.participants;
    let mentions = [];
    let text = '';

    for (const participant of participants) {
        const contact = await participant.id._serialized;
        mentions.push(contact);
        text += `@${participant.id.user} `;
    }

    return { mentions, text };
}

/**
 * Formata a data atual no formato brasileiro
 * @returns {string} - Data formatada (ex: "29/12/2025")
 */
function formatarData() {
    const hoje = new Date();
    const dia = String(hoje.getDate()).padStart(2, '0');
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    const ano = hoje.getFullYear();
    return `${dia}/${mes}/${ano}`;
}

/**
 * Obtém o dia da semana em português
 * @returns {string} - Nome do dia da semana
 */
function getDiaSemana() {
    const dias = [
        'Domingo',
        'Segunda-feira',
        'Terça-feira',
        'Quarta-feira',
        'Quinta-feira',
        'Sexta-feira',
        'Sábado'
    ];
    return dias[new Date().getDay()];
}

/**
 * Obtém a lista de grupos autorizados do .env
 * @returns {Array<string>} - Array com IDs dos grupos
 */
function getGruposAutorizados() {
    const grupos = process.env.GRUPOS_AUTORIZADOS;
    if (!grupos || grupos.trim() === '') {
        return [];
    }
    return grupos.split(',').map(g => g.trim()).filter(g => g !== '');
}

/**
 * Obtém o ID do grupo específico onde a tiragem automática deve ocorrer
 * @returns {string|null} - ID do grupo ou null se não configurado
 */
function getGrupoTiragem() {
    return process.env.ID_GRUPO_TIRAGEM || null;
}

/**
 * Verifica se o grupo está autorizado
 * @param {string} chatId - ID do chat
 * @returns {boolean} - Se o grupo está autorizado
 */
function isGrupoAutorizado(chatId) {
    const gruposAutorizados = getGruposAutorizados();
    // Se não há grupos configurados, permite todos para os comandos manuais
    if (gruposAutorizados.length === 0) {
        return true;
    }
    return gruposAutorizados.includes(chatId);
}

/**
 * Obtém o prefixo de comando do .env
 * @returns {string} - Prefixo do comando (padrão: !)
 */
function getPrefixo() {
    return process.env.PREFIXO_COMANDO || '!';
}

module.exports = {
    marcarTodos,
    formatarData,
    getDiaSemana,
    getGruposAutorizados,
    getGrupoTiragem,
    isGrupoAutorizado,
    getPrefixo
};
