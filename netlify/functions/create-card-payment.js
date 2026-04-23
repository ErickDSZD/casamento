const fetch = require('node-fetch');

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': 'https://casamentoge.netlify.app/',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  try {
    const { 
      amount, 
      description, 
      token, 
      paymentMethodId,
      installments = 1,
      payerEmail,
      docNumber
    } = JSON.parse(event.body);
    
    const accessToken = process.env.MP_ACCESS_TOKEN_PRODUCTION;

    const paymentData = {
      transaction_amount: parseFloat(amount),
      description: description,
      payment_method_id: paymentMethodId || 'visa',
      token: token,
      installments: installments,
      payer: {
        email: payerEmail || 'convidado@casamento.com',
        identification: {
          type: 'CPF',
          number: docNumber.replace(/\D/g, '')
        }
      },
      metadata: {
        presente_nome: description
      }
    };

    const response = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(paymentData)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Erro ao processar pagamento');
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        paymentId: data.id,
        status: data.status,
        statusDetail: data.status_detail
      })
    };

  } catch (error) {
    console.error('Erro:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: error.message })
    };
  }
};