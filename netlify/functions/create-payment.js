const fetch = require('node-fetch');

exports.handler = async (event, context) => {
  // Configuração CORS para permitir requisições do seu domínio
  const headers = {
    'Access-Control-Allow-Origin': 'https://casamentoge.netlify.app/',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  // Responder preflight requests
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
    const { amount, description, payerEmail, payerName } = JSON.parse(event.body);
    
    // Pega o Access Token das variáveis de ambiente do Netlify
    const accessToken = process.env.MP_ACCESS_TOKEN_PRODUCTION;
    
    if (!accessToken) {
      throw new Error('Access Token não configurado');
    }

    // Dados do pagamento PIX
    const paymentData = {
      transaction_amount: parseFloat(amount),
      description: description,
      payment_method_id: 'pix',
      payer: {
        email: payerEmail || 'convidado@casamento.com',
        first_name: payerName || 'Convidado',
        last_name: 'Casamento',
        identification: {
          type: 'CPF',
          number: '12345678909'
        }
      },
      notification_url: `https://${event.headers.host}/.netlify/functions/payment-webhook`,
      metadata: {
        presente_id: event.body.presenteId || 'unknown',
        presente_nome: description
      }
    };

    console.log('Criando pagamento PIX:', { amount, description });

    const response = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': `${Date.now()}-${Math.random()}`
      },
      body: JSON.stringify(paymentData)
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Erro Mercado Pago:', data);
      throw new Error(data.message || 'Erro ao criar pagamento');
    }

    console.log('Pagamento criado:', data.id);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        paymentId: data.id,
        qrCode: data.point_of_interaction.transaction_data.qr_code,
        qrCodeBase64: data.point_of_interaction.transaction_data.qr_code_base64,
        pixCode: data.point_of_interaction.transaction_data.qr_code,
        status: data.status
      })
    };

  } catch (error) {
    console.error('Erro na função create-payment:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false, 
        error: error.message || 'Erro interno ao processar pagamento' 
      })
    };
  }
};