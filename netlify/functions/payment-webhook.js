const crypto = require('crypto');

exports.handler = async (event, context) => {
  // Log para debug
  console.log('Webhook recebido - Method:', event.httpMethod);
  console.log('Headers:', JSON.stringify(event.headers, null, 2));
  
  // Verificar método
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }
  
  // Verificar se tem body
  if (!event.body) {
    console.error('Body vazio');
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Empty body' })
    };
  }
  
  // Verificar assinatura do webhook (segurança)
  const signature = event.headers['x-signature'];
  const webhookSecret = process.env.MP_WEBHOOK_SECRET;
  
  // Validar assinatura APENAS se estiver em produção e tiver o secret configurado
  if (webhookSecret && signature && process.env.CONTEXT === 'production') {
    const isValid = validateWebhookSignature(signature, event.body, webhookSecret);
    if (!isValid) {
      console.error('❌ Assinatura inválida do webhook');
      return { 
        statusCode: 401, 
        body: JSON.stringify({ error: 'Unauthorized - Invalid signature' })
      };
    }
    console.log('✅ Assinatura validada com sucesso');
  } else if (!webhookSecret) {
    console.warn('⚠️ MP_WEBHOOK_SECRET não configurado - pulando validação');
  } else if (!signature) {
    console.warn('⚠️ x-signature não encontrada no header');
  }
  
  try {
    // Parse do body (pode vir como string já)
    let paymentData;
    if (typeof event.body === 'string') {
      paymentData = JSON.parse(event.body);
    } else {
      paymentData = event.body;
    }
    
    console.log('Dados recebidos:', JSON.stringify(paymentData, null, 2));
    
    // Verificar se é notificação de pagamento
    if (paymentData.type === 'payment') {
      const paymentId = paymentData.data.id;
      const action = paymentData.action; // payment.created, payment.updated, etc.
      
      console.log(`📥 Webhook recebido: Pagamento ${paymentId} - Action: ${action}`);
      
      // Buscar detalhes do pagamento
      const accessToken = process.env.MP_ACCESS_TOKEN_PRODUCTION;
      
      if (!accessToken) {
        console.error('❌ MP_ACCESS_TOKEN_PRODUCTION não configurado');
        return {
          statusCode: 500,
          body: JSON.stringify({ error: 'Access token not configured' })
        };
      }
      
      // Buscar informações do pagamento na API do Mercado Pago
      const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        method: 'GET',
        headers: { 
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        console.error(`❌ Erro ao buscar pagamento: ${response.status}`);
        return {
          statusCode: 200, // Retorna 200 mesmo assim para não tentar reenviar
          body: JSON.stringify({ received: true, error: 'Could not fetch payment details' })
        };
      }
      
      const payment = await response.json();
      console.log(`💰 Pagamento ${paymentId} - Status: ${payment.status}`);
      
      if (payment.status === 'approved') {
        console.log(`✅ Pagamento ${paymentId} APROVADO!`);
        console.log(`🎁 Presente: ${payment.metadata?.presente_nome || 'Não especificado'}`);
        console.log(`💵 Valor: R$ ${payment.transaction_amount}`);
        console.log(`👤 Pagador: ${payment.payer?.email || 'Não informado'}`);
        
        // TODO: Atualizar seu sistema aqui
        // Exemplo: Marcar presente como 'gifted' no JSON
        // await marcarPresenteComoPago(payment.metadata?.presente_id);
        
      } else if (payment.status === 'pending') {
        console.log(`⏳ Pagamento ${paymentId} pendente`);
      } else if (payment.status === 'rejected') {
        console.log(`❌ Pagamento ${paymentId} rejeitado`);
      }
      
    } else if (paymentData.type === 'merchant_order') {
      const orderId = paymentData.data.id;
      console.log(`📦 Pedido recebido ID: ${orderId}`);
      
    } else {
      console.log(`ℹ️ Tipo de notificação ignorado: ${paymentData.type}`);
    }
    
    // Retornar 200 para o Mercado Pago não tentar reenviar
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        received: true,
        timestamp: new Date().toISOString()
      })
    };
    
  } catch (error) {
    console.error('❌ Erro no processamento do webhook:', error);
    console.error('Stack:', error.stack);
    
    // Mesmo com erro, retornar 200 para evitar reenvios infinitos
    return {
      statusCode: 200, // Importante: retornar 200 para não floodar
      body: JSON.stringify({ 
        error: 'Webhook processing failed',
        message: error.message 
      })
    };
  }
};

/**
 * Valida a assinatura do webhook do Mercado Pago
 * Formato do signature: "ts=1734998400,v1=hash"
 */
function validateWebhookSignature(signature, body, secret) {
  try {
    // Parse do signature
    const parts = signature.split(',');
    const tsPart = parts.find(p => p.startsWith('ts='));
    const v1Part = parts.find(p => p.startsWith('v1='));
    
    if (!tsPart || !v1Part) {
      console.error('Formato de signature inválido:', signature);
      return false;
    }
    
    const timestamp = tsPart.split('=')[1];
    const receivedHash = v1Part.split('=')[1];
    
    // Parse do body para pegar o ID
    let bodyData;
    if (typeof body === 'string') {
      bodyData = JSON.parse(body);
    } else {
      bodyData = body;
    }
    
    // Construir o manifesto para hash
    // O formato correto é: "id:{id};topic:{topic}"
    const manifest = `id:${bodyData.data.id};topic:${bodyData.type}`;
    
    // Gerar hash com timestamp
    const signedManifest = `${timestamp}.${manifest}`;
    const expectedHash = crypto
      .createHmac('sha256', secret)
      .update(signedManifest)
      .digest('hex');
    
    console.log('Validando assinatura:');
    console.log('- Manifest:', manifest);
    console.log('- Signed manifest:', signedManifest);
    console.log('- Expected hash:', expectedHash);
    console.log('- Received hash:', receivedHash);
    
    const isValid = crypto.timingSafeEqual(
      Buffer.from(expectedHash, 'hex'),
      Buffer.from(receivedHash, 'hex')
    );
    
    return isValid;
    
  } catch (error) {
    console.error('Erro na validação da assinatura:', error);
    return false;
  }
}