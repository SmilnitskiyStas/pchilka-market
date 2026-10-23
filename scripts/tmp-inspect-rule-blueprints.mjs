import fs from 'node:fs';
import pg from 'pg';

const text = fs.readFileSync(new URL('../docs/підключення до бази.txt', import.meta.url), 'utf8');
const hostPort = text.match(/Сервер\s+([^:\s]+):(\d+)/i);
const user = text.match(/логін:\s*(\S+)/i);
const password = text.match(/пароль:\s*(\S+)/i);
const database = text.match(/база:\s*(\S+)/i);
if (!hostPort || !user || !password || !database) throw new Error('Cannot parse source connection.');
const db = new pg.Client({ host: hostPort[1], port: Number(hostPort[2]), user: user[1], password: password[1], database: database[1], application_name: 'pchilka_rule_blueprints_inspect', options: '-c default_transaction_read_only=on' });
await db.connect();
try {
  const columns = await db.query(`SELECT column_name,data_type FROM information_schema.columns WHERE table_schema='pos' AND table_name='synonym_exp' ORDER BY ordinal_position`);
  const propertyBlueprints = await db.query(`
    SELECT code_field, synonym, abr_name, description, expression, type_field, code_parent_field
    FROM pos.synonym_exp
    WHERE coalesce(expression,'') ILIKE '%client_property%'
       OR coalesce(synonym,'') ILIKE '%свойств%'
       OR coalesce(abr_name,'') ILIKE '%свойств%'
       OR coalesce(description,'') ILIKE '%свойств%'
    ORDER BY code_field
  `);
  const clientBlueprints = await db.query(`
    SELECT code_field, synonym, abr_name, description, type_field, code_parent_field
    FROM pos.synonym_exp
    WHERE coalesce(synonym,'') ILIKE '%клиент%'
       OR coalesce(abr_name,'') ILIKE '%клиент%'
    ORDER BY code_parent_field, code_field
  `);
  const resultBlueprints = await db.query(`
    SELECT code_field, synonym, abr_name, description, expression, type_field, code_parent_field
    FROM pos.synonym_exp
    WHERE coalesce(synonym,'') ILIKE ANY(ARRAY['%запомнить%','%срабатыван%','%скидк%','%сумма позиции%','%цена позиции%'])
       OR coalesce(abr_name,'') ILIKE ANY(ARRAY['%запомнить%','%срабатыван%','%скидк%','%сумма позиции%','%цена позиции%'])
    ORDER BY code_parent_field, code_field
  `);
  const exactResultBlueprints = await db.query(`
    SELECT code_field, synonym, abr_name, description, type_field, code_parent_field
    FROM pos.synonym_exp
    WHERE coalesce(synonym,'') ILIKE ANY(ARRAY['%запомнить срабатывание текущего правила%','%сумма текущей товарной позиции%','%установить сумму%','%скидка на текущий товар%'])
       OR coalesce(abr_name,'') ILIKE ANY(ARRAY['%запомнить срабатывание текущего правила%','%сумма текущей товарной позиции%','%установить сумму%','%скидка на текущий товар%'])
    ORDER BY code_field
  `);
  console.log(JSON.stringify({ propertyBlueprints: propertyBlueprints.rows, exactResultBlueprints: exactResultBlueprints.rows }, null, 2));
} finally { await db.end(); }
