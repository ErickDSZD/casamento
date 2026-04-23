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
        // Busca o JSON público (já que ele está acessível)
        const siteUrl = process.env.URL || 'https://casamentoge.netlify.app';
        const response = await fetch(`${siteUrl}/data/presentes.json`);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.text();
        
        return {
            statusCode: 200,
            headers,
            body: data
        };
    } catch (error) {
        console.error('Erro:', error);
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: 'Erro ao carregar dados',
                details: error.message
            })
        };
    }
};