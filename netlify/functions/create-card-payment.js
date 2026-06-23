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

    // Limpa o número do documento
    const cleanDocNumber = identificationNumber.replace(/\D/g, '');

    // Validação do CPF
    if (identificationType === 'CPF' && cleanDocNumber.length !== 11) {
      throw new Error('CPF deve conter 11 dígitos');
    }

    // Estrutura base do paymentData conforme documentação
    const paymentData = {
      transaction_amount: parseFloat(amount),
      description: description,
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

    // IMPORTANTE: Para débito, é OBRIGATÓRIO enviar o payment_method_id correto
    if (paymentType === 'debit') {
      // Mapeamento de bandeiras para débito
      const debitMethodMap = {
        'visa': 'visa_debit',
        'master': 'master_debit',
        'amex': 'amex_debit',
        'elo': 'elo_debit',
        'hipercard': 'hipercard_debit'
      };
      
      const mappedMethodId = debitMethodMap[cardBrand?.toLowerCase()];
      
      if (mappedMethodId) {
        paymentData.payment_method_id = mappedMethodId;
      } else if (paymentMethodId) {
        paymentData.payment_method_id = paymentMethodId;
      } else {
        throw new Error('Para pagamentos com débito, é necessário informar o payment_method_id');
      }
    } else {
      // Para crédito, podemos enviar o payment_method_id ou deixar inferir
      if (paymentMethodId) {
        paymentData.payment_method_id = paymentMethodId;
      } else {
        // Para crédito, enviamos o payment_type_id para ajudar na inferência
        paymentData.payment_type_id = 'credit_card';
      }
    }

    // Adicionar issuer_id se fornecido (útil para parcelamento)
    if (issuerId) {
      paymentData.issuer_id = parseInt(issuerId);
    }

    const idempotencyKey = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}-${description.substring(0, 20)}`;

    console.log('Enviando pagamento:', {
      amount,
      payment_method_id: paymentData.payment_method_id || 'a ser inferido',
      payment_type_id: paymentData.payment_type_id,
      paymentType,
      cardBrand,
      installments
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

      // Tratamento específico para erro 2131
      if (data.status === 400 && data.cause) {
        const hasError2131 = data.cause.some(cause => cause.code === '2131');
        if (hasError2131) {
          throw new Error('Erro ao identificar método de pagamento. Verifique se o payment_method_id está correto para débito ou se o token é válido.');
        }
        
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