const fs = require('fs').promises;
const path = require('path');

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };
    
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }
    
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Método não permitido' })
        };
    }
    
    try {
        const { action, presente, id } = JSON.parse(event.body);
        const dataPath = path.resolve(__dirname, '../../data/presentes.json');
        
        // Ler dados atuais
        const data = await fs.readFile(dataPath, 'utf8');
        let jsonData = JSON.parse(data);
        
        // Ações
        if (action === 'create') {
            jsonData.presentes.push(presente);
        } else if (action === 'update') {
            const index = jsonData.presentes.findIndex(p => p.id === presente.id);
            if (index !== -1) {
                jsonData.presentes[index] = presente;
            }
        } else if (action === 'delete') {
            jsonData.presentes = jsonData.presentes.filter(p => p.id !== id);
        }
        
        // Salvar dados
        await fs.writeFile(dataPath, JSON.stringify(jsonData, null, 2));
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true })
        };
    } catch (error) {
        console.error('Erro:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Erro ao atualizar dados' })
        };
    }
};