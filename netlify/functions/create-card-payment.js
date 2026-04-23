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
      payerEmail,
      docNumber,
      cardBrand  // ← Receber a bandeira
    } = JSON.parse(event.body);
    
    const accessToken = process.env.MP_ACCESS_TOKEN_PRODUCTION;
    
    if (!accessToken) {
      throw new Error('Access Token não configurado');
    }

    // Mapeamento de payment_method_id válidos
    const validPaymentMethods = {
      visa: 'visa',
      master: 'master',
      amex: 'amex',
      elo: 'elo',
      hipercard: 'hipercard',
      diners: 'diners',
      visa_debit: 'visa_debit',
      master_debit: 'master_debit'
    };

    // Validar o payment_method_id
    let finalPaymentMethodId = paymentMethodId;
    if (!validPaymentMethods[paymentMethodId]) {
      console.warn(`Payment method ${paymentMethodId} inválido, usando fallback para visa`);
      finalPaymentMethodId = 'visa';
    }

    const paymentData = {
      transaction_amount: parseFloat(amount),
      description: description,
      payment_method_id: finalPaymentMethodId,
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
        presente_nome: description,
        payment_type: 'card',
        card_brand: cardBrand || 'unknown'
      }
    };

    // Gerar chave de idempotência
    const idempotencyKey = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}-${description.replace(/\s/g, '')}`;

    console.log('Criando pagamento com cartão:', { 
      amount, 
      description, 
      paymentMethodId: finalPaymentMethodId,
      cardBrand 
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
      console.error('Erro Mercado Pago:', data);
      throw new Error(data.message || 'Erro ao processar pagamento');
    }

    console.log('Pagamento com cartão criado:', data.id, 'Status:', data.status);

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