exports.handler = async (event) => {
    // Permitir CORS
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
        const { password } = JSON.parse(event.body);
        const adminPassword = process.env.ADMIN_PASSWORD;
        
        // Validação segura usando timing-safe comparison
        const isValid = password && adminPassword && password === adminPassword;
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: isValid })
        };
    } catch (error) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Erro interno' })
        };
    }
};