-- Tabela para presentes.json
CREATE TABLE presentes (
    id SERIAL PRIMARY KEY,
    nome TEXT NOT NULL,
    categoria TEXT,
    preco DECIMAL(10, 2),
    descricao TEXT,
    imagem TEXT,
    status TEXT,
    link_externo TEXT,
    detalhes JSONB
);

-- Tabela para lua_de_mel.json
CREATE TABLE lua_de_mel (
    id SERIAL PRIMARY KEY,
    nome TEXT NOT NULL,
    categoria TEXT,
    preco DECIMAL(10, 2),
    descricao TEXT,
    imagem TEXT,
    status TEXT,
    link_externo TEXT,
    detalhes JSONB
);