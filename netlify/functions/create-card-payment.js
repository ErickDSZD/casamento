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
    const {
      amount,
      description,
      token,
      paymentMethodId,
      installments = 1,
      issuerId,
      identificationType = 'CPF',
      identificationNumber,
      payerEmail,
      cardBrand,
      paymentType = 'credit'
    } = JSON.parse(event.body);

    const accessToken = process.env.MP_ACCESS_TOKEN_PRODUCTION;

    if (!accessToken) {
      throw new Error('Access Token não configurado');
    }

    // Validação do número do documento
    if (!identificationNumber) {
      throw new Error('Número do documento é obrigatório');
    }

    // Limpa o número do documento (remove caracteres não numéricos)
    const cleanDocNumber = identificationNumber.replace(/\D/g, '');

    // Validação básica do documento (ajuste conforme necessário)
    if (identificationType === 'CPF' && cleanDocNumber.length !== 11) {
      throw new Error('CPF deve conter 11 dígitos');
    }

    // Preparar dados do pagamento conforme documentação do Checkout Transparente
    const paymentData = {
      transaction_amount: parseFloat(amount),
      description: description,
      payment_method_id: paymentMethodId,
      token: token,
      installments: parseInt(installments),
      payer: {
        email: payerEmail,
        identification: {
          type: identificationType,
          number: cleanDocNumber
        }
      },
      metadata: {
        presente_nome: description,
        card_brand: cardBrand,
        payment_type: paymentType
      }
    };

    // Adicionar issuer_id no paymentData APÓS a declaração
    if (issuerId) {
      paymentData.issuer_id = parseInt(issuerId);
    }

    // Para débito, o payment_method_id já deve ser algo como "visa_debit" ou "master_debit"
    if (paymentType === 'debit') {
      paymentData.payment_method_id = paymentMethodId;
    }

    const idempotencyKey = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}-${description.substring(0, 20)}`;

    console.log('Enviando pagamento:', {
      amount,
      paymentMethodId,
      cardBrand,
      paymentType,
      identificationType,
      hasDocument: !!identificationNumber
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
      console.error('Erro detalhado Mercado Pago:', JSON.stringify(data, null, 2));

      if (data.cause && data.cause.length > 0) {
        const causes = data.cause.map(c => c.description).join(', ');
        throw new Error(`Erro no pagamento: ${causes}`);
      }

      if (data.status === 400) {
        const errorMessage = data.cause?.[0]?.description || data.message;
        throw new Error(`Dados inválidos: ${errorMessage}`);
      }

      if (data.status === 401) {
        throw new Error('Erro de autenticação. Verifique as credenciais.');
      }

      throw new Error(data.message || 'Erro ao processar pagamento');
    }

    console.log('Pagamento criado com sucesso:', {
      id: data.id,
      status: data.status,
      statusDetail: data.status_detail,
      paymentType: data.payment_type_id
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        paymentId: data.id,
        status: data.status,
        statusDetail: data.status_detail,
        paymentType: data.payment_type_id,
        cardBrand: data.card?.payment_method?.id || cardBrand
      })
    };

  } catch (error) {
    console.error('Erro na função create-card-payment:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Erro interno ao processar pagamento',
        type: error.name || 'InternalError'
      })
    };
  }
};