import { readFileSync,writeFileSync,readdirSync } from 'node:fs';
// Keep the one-file setup repair and versioned migrations in agreement.
const migrations=readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')).sort();
let initial=readFileSync('supabase/migrations/'+migrations[0],'utf8');
initial=initial.replaceAll('create table public.','create table if not exists public.').replaceAll('create index ','create index if not exists ').replaceAll('create function public.','create or replace function public.');
initial=initial.replace(/create policy (\w+) on ([\w.]+)/g,(_,name,table)=>`drop policy if exists ${name} on ${table};\ncreate policy ${name} on ${table}`);
initial=initial.replace('create trigger message_notification','drop trigger if exists message_notification on public.messages;\ncreate trigger message_notification');
writeFileSync('supabase/setup.sql','-- YapSpace setup / missing-function repair\n-- Run the whole file in a dedicated YapSpace project. Existing rows are preserved.\n-- Replaces only YapSpace-owned policies/functions; incompatible schemas fail.\n\n'+initial+'\n'+migrations.slice(1).map(name=>readFileSync('supabase/migrations/'+name,'utf8')).join('\n')+"\nnotify pgrst,'reload schema';\n");
