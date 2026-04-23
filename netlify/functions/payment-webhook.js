const crypto = require('crypto');

exports.handler = async (event, context) => {
  // Verificar assinatura do webhook (segurança)
  const signature = event.headers['x-signature'];
  const webhookSecret = process.env.MP_WEBHOOK_SECRET;
  
  // Validar assinatura (opcional mas recomendado)
  if (webhookSecret && signature) {
    const isValid = validateWebhookSignature(signature, event.body, webhookSecret);
    if (!isValid) {
      console.error('Assinatura inválida do webhook');
      return { statusCode: 401, body: 'Unauthorized' };
    }
  }

  try {
    const paymentData = JSON.parse(event.body);
    
    // Verificar se é notificação de pagamento
    if (paymentData.type === 'payment') {
      const paymentId = paymentData.data.id;
      
      console.log(`Webhook recebido: Pagamento ${paymentId} - Status: ${paymentData.action}`);
      
      // Aqui você pode:
      // 1. Salvar no banco de dados que o presente foi pago
      // 2. Enviar email de confirmação
      // 3. Atualizar status no frontend via websocket
      
      // Buscar detalhes do pagamento
      const accessToken = process.env.MP_ACCESS_TOKEN_PRODUCTION;
      const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      
      const payment = await response.json();
      
      if (payment.status === 'approved') {
        console.log(`✅ Pagamento ${paymentId} aprovado!`);
        console.log(`Presente: ${payment.metadata?.presente_nome}`);
        console.log(`Valor: R$ ${payment.transaction_amount}`);
        
        // TODO: Atualizar seu sistema aqui
        // Ex: Marcar presente como 'gifted' no JSON
      }
    }
    
    return {
      statusCode: 200,
      body: JSON.stringify({ received: true })
    };
    
  } catch (error) {
    console.error('Erro no webhook:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Webhook processing failed' })
    };
  }
};

function validateWebhookSignature(signature, body, secret) {
  const [timestamp, hash] = signature.split(',');
  const manifest = `id:${JSON.parse(body).id};topic:payment`;
  const expectedHash = crypto
    .createHmac('sha256', secret)
    .update(manifest)
    .digest('hex');
  
  return hash === expectedHash;
}