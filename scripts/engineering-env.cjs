const { readFile } = require('node:fs/promises');
const path = require('node:path');

function resolveEngineeringEnvPath() {
  if (process.env.ENGINEERING_ENV_FILE) return path.resolve(process.env.ENGINEERING_ENV_FILE);
  return path.join(process.cwd(), '.env');
}
function parseEngineeringEnv(source) {
  const values = {};
  for (const line of source.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?ENGINEERING_([A-Z_]+)\s*=\s*(.*?)\s*$/);
    if (!match) continue;
    const raw = match[2];
    if (raw.startsWith('"')) {
      const quoted = raw.match(/^"(?:\\.|[^"\\])*"/);
      if (quoted) { try { values[match[1]] = String(JSON.parse(quoted[0])); continue; } catch {} }
    }
    if (raw.startsWith("'") && raw.lastIndexOf("'") > 0) values[match[1]] = raw.slice(1, raw.lastIndexOf("'"));
    else values[match[1]] = raw.replace(/\s+#.*$/, '').trim();
  }
  return values;
}
async function readOptional(filePath) {
  try { return await readFile(filePath, 'utf8'); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}
async function readEngineeringEnv() {
  const filePath = resolveEngineeringEnvPath();
  const source = await readOptional(filePath);
  if (source !== null) return { values: parseEngineeringEnv(source), filePath, sourcePath: filePath, exists: true };
  const legacyPath = path.join(process.cwd(), '.env');
  // Preserve existing configuration when a deployment first switches to the private persistent file.
  const legacy = path.resolve(legacyPath) !== filePath ? await readOptional(legacyPath) : null;
  return { values: parseEngineeringEnv(legacy || ''), filePath, sourcePath: legacy !== null ? legacyPath : null, exists: false };
}
function isEngineeringEnabled(value) { return ['true', '1', 'yes', 'on'].includes(String(value ?? '').trim().toLowerCase()); }
module.exports = { resolveEngineeringEnvPath, parseEngineeringEnv, readEngineeringEnv, isEngineeringEnabled };
