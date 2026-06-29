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

    const cleanDocNumber = identificationNumber.replace(/\D/g, '');

    if (identificationType === 'CPF' && cleanDocNumber.length !== 11) {
      throw new Error('CPF deve conter 11 dígitos');
    }

    let tokenInfo = null;
    try {
      const tokenResponse = await fetch(`https://api.mercadopago.com/v1/card_tokens/${token}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      if (tokenResponse.ok) {
        tokenInfo = await tokenResponse.json();
        console.log('Informações do token:', {
          payment_method_id: tokenInfo.payment_method_id,
          card_holder: tokenInfo.card_holder?.name,
          first_six_digits: tokenInfo.first_six_digits,
          last_four_digits: tokenInfo.last_four_digits
        });
      } else {
        console.warn('Não foi possível obter informações do token:', tokenResponse.status);
      }
    } catch (tokenError) {
      console.warn('Erro ao buscar token:', tokenError.message);
    }

    // Estrutura base do paymentData
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

    let finalPaymentMethodId = null;
    
    if (tokenInfo && tokenInfo.payment_method_id) {
      // Usa o payment_method_id do token
      finalPaymentMethodId = tokenInfo.payment_method_id;
      console.log('Usando payment_method_id do token:', finalPaymentMethodId);
    } else if (paymentMethodId) {
      // Fallback para o paymentMethodId enviado
      finalPaymentMethodId = paymentMethodId;
      console.log('Usando payment_method_id enviado:', finalPaymentMethodId);
    }

    // Para débito, precisa mapear para o ID correto
    if (paymentType === 'debit') {
      if (tokenInfo && tokenInfo.payment_method_id) {
        // Se temos o ID do token, converte para débito se necessário
        const debitMethodMap = {
          'visa': 'visa_debit',
          'master': 'master_debit',
          'amex': 'amex_debit',
          'elo': 'elo_debit',
          'hipercard': 'hipercard_debit'
        };
        
        const mappedMethodId = debitMethodMap[tokenInfo.payment_method_id?.toLowerCase()];
        if (mappedMethodId) {
          finalPaymentMethodId = mappedMethodId;
        }
      } else if (cardBrand) {
        // Fallback para cardBrand
        const debitMethodMap = {
          'visa': 'visa_debit',
          'master': 'master_debit',
          'amex': 'amex_debit',
          'elo': 'elo_debit',
          'hipercard': 'hipercard_debit'
        };
        finalPaymentMethodId = debitMethodMap[cardBrand.toLowerCase()] || paymentMethodId;
      }
    }

    // Define o payment_method_id no paymentData
    if (finalPaymentMethodId) {
      paymentData.payment_method_id = finalPaymentMethodId;
    } else if (paymentType === 'credit') {
      // Para crédito, podemos deixar o Mercado Pago inferir
      paymentData.payment_type_id = 'credit_card';
    } else {
      throw new Error('Não foi possível determinar o método de pagamento');
    }

    // Adicionar issuer_id se fornecido
    if (issuerId) {
      paymentData.issuer_id = parseInt(issuerId);
    }

    // Adicionar statement_descriptor para melhor identificação
    paymentData.statement_descriptor = 'Lista de Presentes';

    const idempotencyKey = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}-${description.substring(0, 20)}`;

    console.log('Enviando pagamento:', {
      amount,
      payment_method_id: paymentData.payment_method_id || 'a ser inferido',
      payment_type_id: paymentData.payment_type_id,
      paymentType,
      cardBrand,
      installments,
      token_info: tokenInfo ? {
        payment_method_id: tokenInfo.payment_method_id,
        first_six: tokenInfo.first_six_digits
      } : null
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

      // Tratamento específico para erro de inferência
      if (data.status === 400 && data.cause) {
        const hasError2131 = data.cause.some(cause => cause.code === '2131');
        if (hasError2131) {
          // Tenta novamente com payment_type_id apenas
          console.log('Tentando novamente sem payment_method_id específico...');
          delete paymentData.payment_method_id;
          paymentData.payment_type_id = 'credit_card';
          
          const retryResponse = await fetch('https://api.mercadopago.com/v1/payments', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
              'X-Idempotency-Key': idempotencyKey + '-retry'
            },
            body: JSON.stringify(paymentData)
          });
          
          const retryData = await retryResponse.json();
          
          if (retryResponse.ok) {
            console.log('Pagamento aprovado na segunda tentativa:', retryData.id);
            return {
              statusCode: 200,
              headers,
              body: JSON.stringify({
                success: true,
                paymentId: retryData.id,
                status: retryData.status,
                statusDetail: retryData.status_detail,
                paymentType: retryData.payment_type_id,
                cardBrand: retryData.card?.payment_method?.id || cardBrand
              })
            };
          }
        }
        
        const causes = data.cause.map(c => c.description).join(', ');
        throw new Error(`Erro no pagamento: ${causes}`);
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