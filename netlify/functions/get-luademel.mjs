// netlify/functions/get-luademel.mjs
import { getConnectionString } from '@netlify/database';
import pg from 'pg';

export default async (req) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS'
  };

  if (req.method === 'OPTIONS') {
    return new Response('', { status: 200, headers });
  }

  try {
    const connectionString = getConnectionString();
    const pool = new pg.Pool({ connectionString });

    const { rows } = await pool.query('SELECT * FROM lua_de_mel ORDER BY id');
    await pool.end();

    return Response.json({
      presentes: rows.map(r => ({
        id: r.id,
        nome: r.nome,
        categoria: r.categoria,
        preco: Number(r.preco),
        descricao: r.descricao,
        imagem: r.imagem,
        status: r.status,
        linkExterno: r.link_externo,
        detalhes: r.detalhes || []
      }))
    }, { headers });

  } catch (error) {
    console.error('get-luademel error:', error);
    return Response.json(
      { error: 'Erro interno', detail: error.message },
      { status: 500, headers }
    );
  }
};