#!/usr/bin/env node
/**
 * migration/import.mjs
 *
 * One-shot importer from Lovable export JSON → Clairmont Advisory Supabase.
 *
 * Before running this script:
 *   1. Schema must already be applied on Clairmont Advisory (it is — 21 migrations applied).
 *   2. The `on_auth_user_created` trigger MUST be dropped on auth.users so our explicit
 *      profile + user_role inserts aren't double-written by handle_new_user().
 *   3. SUPABASE_SERVICE_ROLE_KEY env var must be set.
 *
 * After running:
 *   1. Re-create the `on_auth_user_created` trigger on auth.users.
 *   2. Verify row counts match the export JSON.
 *
 * Usage:
 *   export SUPABASE_SERVICE_ROLE_KEY="<key-from-.env.local>"
 *   node migration/import.mjs /Users/destinypraktika/Downloads/clairmont-export-2026-04-20T19-02-36.json
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';

const EXPORT_FILE = process.argv[2];
const SUPABASE_URL = 'https://ufnxliieaejdvxcanqux.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!EXPORT_FILE) {
  console.error('Usage: node migration/import.mjs <path-to-export.json>');
  process.exit(1);
}
if (!SERVICE_ROLE_KEY) {
  console.error('ERROR: SUPABASE_SERVICE_ROLE_KEY env var not set');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const ts = () => new Date().toISOString().slice(11, 19);
const log = (...a) => console.log(`[${ts()}]`, ...a);
const warn = (...a) => console.warn(`[${ts()}] WARN:`, ...a);
const err = (...a) => console.error(`[${ts()}] ERROR:`, ...a);

async function step(label, fn) {
  log(`▶ ${label}`);
  const t0 = Date.now();
  const result = await fn();
  log(`✓ ${label} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  return result;
}

// --- 1. Create auth.users with preserved UUIDs ---
async function createAuthUsers(profiles) {
  let ok = 0,
    fail = 0,
    skip = 0;
  for (const p of profiles) {
    try {
      // Check if user already exists (idempotency)
      const { data: existing } = await supabase.auth.admin.getUserById(p.id);
      if (existing?.user) {
        skip++;
        continue;
      }

      const tempPw = 'TEMP-' + crypto.randomBytes(24).toString('hex');
      const { error } = await supabase.auth.admin.createUser({
        id: p.id,
        email: p.email,
        email_confirm: true,
        password: tempPw,
        user_metadata: { full_name: p.full_name, migrated_from_lovable: true },
      });
      if (error) throw error;
      ok++;
    } catch (e) {
      fail++;
      err(`auth.user ${p.email} (${p.id}):`, e.message);
    }
  }
  log(`  users: ${ok} created, ${skip} skipped, ${fail} failed`);
}

// --- 2. Insert profiles ---
async function insertProfiles(profiles) {
  let ok = 0,
    fail = 0;
  for (const p of profiles) {
    const { error } = await supabase.from('profiles').upsert(
      {
        id: p.id,
        email: p.email,
        full_name: p.full_name,
        avatar_url: p.avatar_url,
        created_at: p.created_at,
      },
      { onConflict: 'id' },
    );
    if (error) {
      fail++;
      err(`profile ${p.email}:`, error.message);
    } else ok++;
  }
  log(`  profiles: ${ok} upserted, ${fail} failed`);
}

// --- 3. Insert user_roles ---
async function insertUserRoles(userRoles) {
  let ok = 0,
    fail = 0;
  for (const r of userRoles) {
    const { error } = await supabase.from('user_roles').upsert(
      {
        id: r.id,
        user_id: r.user_id,
        role: r.role,
      },
      { onConflict: 'user_id,role' },
    );
    if (error) {
      fail++;
      err(`user_role ${r.user_id} ${r.role}:`, error.message);
    } else ok++;
  }
  log(`  user_roles: ${ok} upserted, ${fail} failed`);
}

// --- 4. Insert partner_codes ---
async function insertPartnerCodes(pcs) {
  let ok = 0,
    fail = 0;
  for (const pc of pcs) {
    const { error } = await supabase.from('partner_codes').upsert(pc, { onConflict: 'code' });
    if (error) {
      fail++;
      err(`partner_code ${pc.code}:`, error.message);
    } else ok++;
  }
  log(`  partner_codes: ${ok} upserted, ${fail} failed`);
}

// --- 5. Upsert partner_provision_configs (merge with seed) ---
async function upsertPartnerProvisionConfigs(ppcs) {
  let ok = 0,
    fail = 0;
  for (const ppc of ppcs) {
    const { error } = await supabase
      .from('partner_provision_configs')
      .upsert(ppc, { onConflict: 'partner_code' });
    if (error) {
      fail++;
      err(`partner_provision_config ${ppc.partner_code}:`, error.message);
    } else ok++;
  }
  log(`  partner_provision_configs: ${ok} upserted, ${fail} failed`);
}

// --- 6. Insert folders ---
async function insertFolders(folders) {
  let ok = 0,
    fail = 0;
  for (const f of folders) {
    const { error } = await supabase.from('folders').upsert(f, { onConflict: 'id' });
    if (error) {
      fail++;
      err(`folder ${f.id} (${f.customer_name}):`, error.message);
    } else ok++;
  }
  log(`  folders: ${ok} upserted, ${fail} failed`);
}

// --- 7. Insert documents ---
async function insertDocuments(docs) {
  let ok = 0,
    fail = 0;
  for (const d of docs) {
    const { error } = await supabase.from('documents').upsert(d, { onConflict: 'id' });
    if (error) {
      fail++;
      err(`document ${d.id} (${d.name}):`, error.message);
    } else ok++;
  }
  log(`  documents: ${ok} upserted, ${fail} failed`);
}

// --- 8. Insert knowledge_base ---
async function insertKnowledgeBase(kbs) {
  let ok = 0,
    fail = 0;
  for (const kb of kbs) {
    const { error } = await supabase.from('knowledge_base').upsert(kb, { onConflict: 'id' });
    if (error) {
      fail++;
      err(`knowledge_base ${kb.id}:`, error.message);
    } else ok++;
  }
  log(`  knowledge_base: ${ok} upserted, ${fail} failed`);
}

// --- 9. Insert messages ---
async function insertMessages(msgs) {
  let ok = 0,
    fail = 0;
  for (const m of msgs) {
    const { error } = await supabase.from('messages').upsert(m, { onConflict: 'id' });
    if (error) {
      fail++;
      err(`message ${m.id}:`, error.message);
    } else ok++;
  }
  log(`  messages: ${ok} upserted, ${fail} failed`);
}

// --- 10. Transfer storage files ---
async function transferStorage(storage) {
  for (const [bucket, info] of Object.entries(storage)) {
    if (info.error) {
      warn(`bucket ${bucket}: export had error, skipping — ${info.error}`);
      continue;
    }
    const files = info.files || [];
    log(`  bucket ${bucket}: ${files.length} files to transfer`);

    let ok = 0,
      fail = 0,
      skip = 0;
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      try {
        // Idempotency: check if file already uploaded
        const { data: existing } = await supabase.storage.from(bucket).list(
          f.path.includes('/') ? f.path.split('/').slice(0, -1).join('/') : '',
          { search: f.path.split('/').pop() },
        );
        if (existing?.some((e) => e.name === f.path.split('/').pop())) {
          skip++;
          continue;
        }

        const resp = await fetch(f.signedUrl);
        if (!resp.ok) throw new Error(`download ${resp.status}`);
        const buf = Buffer.from(await resp.arrayBuffer());

        const { error: upErr } = await supabase.storage.from(bucket).upload(f.path, buf, {
          contentType: f.mimetype || 'application/octet-stream',
          upsert: false,
        });
        if (upErr) throw upErr;
        ok++;
      } catch (e) {
        fail++;
        err(`  ${bucket}/${f.path}: ${e.message}`);
      }
      if ((i + 1) % 25 === 0) log(`    ${bucket}: ${i + 1}/${files.length} (ok:${ok} skip:${skip} fail:${fail})`);
    }
    log(`  bucket ${bucket} complete: ${ok} uploaded, ${skip} skipped, ${fail} failed`);
  }
}

// --- main ---
async function main() {
  log('📥 Loading export file:', EXPORT_FILE);
  const data = JSON.parse(await fs.readFile(EXPORT_FILE, 'utf8'));
  log('   exported:', data.exportedAt);
  log('   from:', data.sourceProjectUrl);

  const { tables, storage } = data;
  log('   counts:', {
    profiles: tables.profiles.length,
    user_roles: tables.user_roles.length,
    partner_codes: tables.partner_codes.length,
    partner_provision_configs: tables.partner_provision_configs.length,
    folders: tables.folders.length,
    documents: tables.documents.length,
    knowledge_base: tables.knowledge_base.length,
    messages: tables.messages.length,
  });

  await step('1. Create auth.users (preserving UUIDs)', () => createAuthUsers(tables.profiles));
  await step('2. Upsert profiles', () => insertProfiles(tables.profiles));
  await step('3. Upsert user_roles', () => insertUserRoles(tables.user_roles));
  await step('4. Upsert partner_codes', () => insertPartnerCodes(tables.partner_codes));
  await step('5. Upsert partner_provision_configs', () =>
    upsertPartnerProvisionConfigs(tables.partner_provision_configs),
  );
  await step('6. Upsert folders', () => insertFolders(tables.folders));
  await step('7. Upsert documents', () => insertDocuments(tables.documents));
  await step('8. Upsert knowledge_base', () => insertKnowledgeBase(tables.knowledge_base));
  await step('9. Upsert messages', () => insertMessages(tables.messages));
  await step('10. Transfer storage files', () => transferStorage(storage));

  log('🎉 Import complete.');
}

main().catch((e) => {
  err('FATAL:', e.stack || e.message);
  process.exit(1);
});
