import { getConnectionString } from '@netlify/database';
import pg from 'pg';

export default async (req) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (req.method === 'OPTIONS') {
    return new Response('', { status: 200, headers });
  }

  try {
    const { action, presente, id } = await req.json();
    const connectionString = getConnectionString();
    const pool = new pg.Pool({ connectionString });

    if (action === 'create') {
      await pool.query(
        `INSERT INTO lua_de_mel
         (nome, categoria, preco, descricao, imagem, status, link_externo, detalhes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          presente.nome,
          presente.categoria,
          presente.preco,
          presente.descricao,
          presente.imagem,
          presente.status,
          presente.linkExterno,
          JSON.stringify(presente.detalhes || [])
        ]
      );
    } else if (action === 'update') {
      await pool.query(
        `UPDATE lua_de_mel SET
           nome=$1, categoria=$2, preco=$3, descricao=$4,
           imagem=$5, status=$6, link_externo=$7, detalhes=$8
         WHERE id=$9`,
        [
          presente.nome,
          presente.categoria,
          presente.preco,
          presente.descricao,
          presente.imagem,
          presente.status,
          presente.linkExterno,
          JSON.stringify(presente.detalhes || []),
          presente.id
        ]
      );
    } else if (action === 'delete') {
      await pool.query('DELETE FROM lua_de_mel WHERE id=$1', [id]);
    } else {
      await pool.end();
      return Response.json({ success: false, error: 'Ação inválida' }, { status: 400, headers });
    }

    await pool.end();
    return Response.json({ success: true }, { headers });

  } catch (error) {
    console.error('update-luademel error:', error);
    return Response.json(
      { success: false, error: 'Erro interno', detail: error.message },
      { status: 500, headers }
    );
  }
};