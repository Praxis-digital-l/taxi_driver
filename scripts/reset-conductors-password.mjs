import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const loadedFromFile = new Set();

const stripWrappingQuotes = (value) => {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
};

const loadEnvFile = (filePath) => {
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of content.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/u);
    if (!match) continue;

    const [, key, rawValue] = match;
    const value = stripWrappingQuotes(rawValue.trim());
    const shouldSet = process.env[key] === undefined || loadedFromFile.has(key);
    if (shouldSet) {
      process.env[key] = value;
      loadedFromFile.add(key);
    }
  }
};

const rootDir = process.cwd();
loadEnvFile(path.join(rootDir, '.env'));
loadEnvFile(path.join(rootDir, '.env.local'));

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const defaultPassword = process.env.DEFAULT_TEST_PASSWORD || '123456';

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing env vars: VITE_SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY.');
  console.error('Add SUPABASE_SERVICE_ROLE_KEY to .env.local or run:');
  console.error("SUPABASE_SERVICE_ROLE_KEY='your_real_service_role_key' npm run reset:conductors:password");
  process.exit(1);
}

const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: conductors, error: conductorError } = await adminClient
  .from('profiles')
  .select('id, user_id, full_name, email, role')
  .eq('role', 'conductor')
  .not('user_id', 'is', null)
  .order('email', { ascending: true });

if (conductorError) {
  console.error('Failed to fetch conductors:', conductorError.message);
  process.exit(1);
}

let updated = 0;
let failed = 0;

for (const conductor of conductors || []) {
  const userId = conductor.user_id;
  if (!userId) continue;

  const { error } = await adminClient.auth.admin.updateUserById(userId, {
    password: defaultPassword,
  });

  if (error) {
    failed += 1;
    console.error(`FAIL ${conductor.email}: ${error.message}`);
    continue;
  }

  updated += 1;
  console.log(`OK   ${conductor.email} -> ${defaultPassword}`);
}

console.log(`\nDone. updated=${updated} failed=${failed}`);
