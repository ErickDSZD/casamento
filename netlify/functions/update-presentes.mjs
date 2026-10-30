import { getDatabase } from '@netlify/database';

export default async (req) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (req.method === 'OPTIONS') {
    return new Response('', { status: 200, headers });
  }

  if (req.method !== 'POST') {
    return Response.json({ error: 'Método não permitido' }, { status: 405, headers });
  }

  try {
    const { action, presente, id } = await req.json();
    const db = getDatabase();

    if (action === 'delete') {
      await db.sql`DELETE FROM presentes WHERE id = ${id}`;
      return Response.json({ success: true }, { headers });
    }

    if (action === 'create') {
      const { rows } = await db.sql`
        INSERT INTO presentes (nome, categoria, preco, descricao, imagem, status, link_externo, detalhes)
        VALUES (${presente.nome}, ${presente.categoria}, ${presente.preco}, ${presente.descricao},
                ${presente.imagem}, ${presente.status}, ${presente.linkExterno},
                ${JSON.stringify(presente.detalhes || [])}::jsonb)
        RETURNING id
      `;
      return Response.json({ success: true, id: rows[0].id }, { headers });
    }

    if (action === 'update') {
      await db.sql`
        UPDATE presentes SET
          nome = ${presente.nome},
          categoria = ${presente.categoria},
          preco = ${presente.preco},
          descricao = ${presente.descricao},
          imagem = ${presente.imagem},
          status = ${presente.status},
          link_externo = ${presente.linkExterno},
          detalhes = ${JSON.stringify(presente.detalhes || [])}::jsonb
        WHERE id = ${presente.id}
      `;
      return Response.json({ success: true }, { headers });
    }

    return Response.json({ error: 'Ação inválida' }, { status: 400, headers });
  } catch (error) {
    return Response.json({ error: 'Erro interno' }, { status: 500, headers });
  }
};