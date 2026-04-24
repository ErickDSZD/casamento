const fetch = require('node-fetch');

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': 'https://casamentoge.netlify.app',
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
    const { 
      amount, 
      description, 
      token, 
      paymentMethodId,
      installments = 1,
      docNumber,
      payerEmail,
      cardBrand,
      paymentType = 'credit'
    } = JSON.parse(event.body);
    
    const accessToken = process.env.MP_ACCESS_TOKEN_PRODUCTION;
    
    if (!accessToken) {
      throw new Error('Access Token não configurado');
    }

    // Preparar dados do pagamento conforme documentação do Checkout Transparente
    const paymentData = {
      transaction_amount: parseFloat(amount),
      description: description,
      payment_method_id: paymentMethodId,
      token: token,
      installments: installments,
      payer: {
        email: payerEmail,
        identification: {
          type: 'CPF',
          number: docNumber.replace(/\D/g, '')
        }
      },
      metadata: {
        presente_nome: description,
        card_brand: cardBrand,
        payment_type: paymentType
      }
    };

    // Adicionar campos específicos para débito se necessário
    if (paymentType === 'debit') {
      paymentData.transaction_type = 'debit';
    }

    const idempotencyKey = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;

    console.log('Enviando pagamento:', { 
      amount, 
      paymentMethodId,
      cardBrand,
      paymentType
    });

    const response = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': idempotencyKey
      },
      body: JSON.stringify(paymentData)
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Erro detalhado Mercado Pago:', data);
      
      // Mensagens de erro mais amigáveis
      if (data.status === 400) {
        const errorMessage = data.cause?.[0]?.description || data.message;
        throw new Error(`Dados inválidos: ${errorMessage}`);
      }
      
      throw new Error(data.message || 'Erro ao processar pagamento');
    }

    console.log('Pagamento criado com sucesso:', data.id, 'Status:', data.status);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        paymentId: data.id,
        status: data.status,
        statusDetail: data.status_detail,
        paymentType: data.payment_type_id
      })
    };

  } catch (error) {
    console.error('Erro na função create-card-payment:', error);
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