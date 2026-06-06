const fetch = require('node-fetch');

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': 'https://erickegiovanna.netlify.app/',
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
      body: JSON.stringify({ error: 'Method Not Allowed' }) 
    };
  }

  try {
    const { paymentMethodId, bin } = JSON.parse(event.body);
    const accessToken = process.env.MP_ACCESS_TOKEN_PRODUCTION;
    
    console.log(`Recebido: paymentMethodId=${paymentMethodId}, bin=${bin}`);
    
    if (!accessToken) {
      throw new Error('Access Token não configurado');
    }

    if (!paymentMethodId || !bin) {
      throw new Error('paymentMethodId e bin são obrigatórios');
    }

    // URL correta para buscar issuers
    const url = `https://api.mercadopago.com/v1/payment_methods/card_issuers?payment_method_id=${paymentMethodId}&bin=${bin.substring(0, 6)}`;
    
    console.log(`URL da requisição: ${url}`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    
    console.log(`Resposta da API (status ${response.status}):`, JSON.stringify(data, null, 2));

    // A API retorna um array diretamente
    const issuers = Array.isArray(data) ? data : [];

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ issuers: issuers })
    };
  } catch (error) {
    console.error('Erro ao buscar issuers:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: error.message,
        issuers: [] 
      })
    };
  }
};