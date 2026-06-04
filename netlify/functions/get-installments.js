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
    const { amount, bin, paymentMethodId } = JSON.parse(event.body);
    const accessToken = process.env.MP_ACCESS_TOKEN_PRODUCTION;
    
    if (!accessToken) {
      throw new Error('Access Token não configurado');
    }

    const url = `https://api.mercadopago.com/v1/payment_methods/installments?amount=${amount}&bin=${bin}&payment_method_id=${paymentMethodId}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ installments: data })
    };
  } catch (error) {
    console.error('Erro ao buscar parcelas:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};