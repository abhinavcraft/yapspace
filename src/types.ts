export type Profile = { id: string; handle: string; display_name: string; bio?: string };
export type Conversation = { id: string; peer_id: string; handle: string; display_name: string; last_body: string | null; last_message_at: string | null; unread_count: number; last_seq: number };
export type Message = { id: string; conversation_id: string; sender_id: string; client_message_id: string; seq: number; body: string; created_at: string; status?: 'pending' | 'failed' };
export function reconcile(previous: Message[], incoming: Message[]): Message[] {
  const entries = new Map(previous.map(m => [m.sender_id + ':' + m.client_message_id, m]));
  for (const m of incoming) { const key = m.sender_id + ':' + m.client_message_id; const old = entries.get(key); if (!old || old.status || !m.status) entries.set(key, m); }
  return [...entries.values()].sort((a,b) => Number(!!a.status)-Number(!!b.status) || a.seq-b.seq || a.created_at.localeCompare(b.created_at));
}
export function validateMessage(body: string): string | null { if (!body.trim()) return 'Write a little something first.'; if ([...body].length > 4000) return 'Keep your message under 4,000 characters.'; return null; }
export function contiguousCursor(messages: Message[], start: number): number { const seqs = new Set(messages.filter(m=>!m.status).map(m=>m.seq)); let cursor=start; while(seqs.has(cursor+1)) cursor++; return cursor; }
