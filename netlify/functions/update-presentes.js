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
        
        // Buscar dados atuais via fetch público
        const siteUrl = process.env.URL || 'https://casamentoge.netlify.app';
        const response = await fetch(`${siteUrl}/data/presentes.json`);
        
        if (!response.ok) {
            throw new Error(`Erro ao buscar dados: ${response.status}`);
        }
        
        let jsonData = await response.json();
        
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
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ 
                success: true,
                data: jsonData,
                warning: 'Dados atualizados apenas na memória. Para persistência, configure um banco de dados.'
            })
        };
        
    } catch (error) {
        console.error('Erro:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: 'Erro ao atualizar dados',
                details: error.message 
            })
        };
    }
};