import { getConnectionString } from '@netlify/database';
import pg from 'pg';

export default async (req) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS'
  };

  if (req.method === 'OPTIONS') return new Response('', { status: 200, headers });

  const id = new URL(req.url).searchParams.get('id');
  if (!id || isNaN(Number(id))) {
    return Response.json({ error: 'id inválido' }, { status: 400, headers });
  }

  try {
    const pool = new pg.Pool({ connectionString: getConnectionString() });
    const { rows } = await pool.query('SELECT * FROM presentes WHERE id = $1', [Number(id)]);
    await pool.end();

    if (rows.length === 0) {
      return Response.json({ error: 'não encontrado' }, { status: 404, headers });
    }

    const r = rows[0];
    return Response.json({
      presente: {
        id: r.id,
        nome: r.nome,
        categoria: r.categoria,
        preco: Number(r.preco),
        descricao: r.descricao,
        imagem: r.imagem,
        status: r.status,
        linkExterno: r.link_externo,
        detalhes: r.detalhes || []
      }
    }, { headers });

  } catch (error) {
    console.error('get-presente-por-id error:', error);
    return Response.json({ error: 'Erro interno', detail: error.message }, { status: 500, headers });
  }
};