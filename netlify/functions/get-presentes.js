const fs = require('fs').promises;
const path = require('path');

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
    };
    
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }
    
    try {
        const dataPath = path.resolve(process.cwd(), 'data', 'presentes.json');
        
        console.log('Tentando ler arquivo em:', dataPath);
        
        const data = await fs.readFile(dataPath, 'utf8');
        const presentes = JSON.parse(data);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(presentes)
        };
    } catch (error) {
        console.error('Erro ao ler presentes:', error);
        console.error('Caminho tentado:', dataPath);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Erro ao carregar dados', details: error.message })
        };
    }
};