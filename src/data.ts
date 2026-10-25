import { createClient } from '@supabase/supabase-js';
import type { Conversation, Message, Profile } from './types';
const env = (import.meta as unknown as { env: Record<string,string> }).env;
const url = env.VITE_SUPABASE_URL; const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const supabase = url && key?.startsWith('sb_publishable_') ? createClient(url,key) : null;
export const demoUser: Profile = {id:'you',handle:'alex.morgan',display_name:'Alex Morgan'};
export const demoPeople: Profile[] = [
  {id:'maya',display_name:'Maya Chen',handle:'maya.chen'}, {id:'jordan',display_name:'Jordan Lee',handle:'jordan.lee'},
  {id:'sofia',display_name:'Sofia Martinez',handle:'sofia.m'}, {id:'oliver',display_name:'Oliver Park',handle:'oliver.park'},
  {id:'ava',display_name:'Ava Thompson',handle:'ava.t'}, {id:'leo',display_name:'Leo Williams',handle:'leo.w'},
  {id:'nina',display_name:'Nina Patel',handle:'nina.patel'}, {id:'sam',display_name:'Sam Rivera',handle:'sam.rivera'}
];
const stamp = (hour:number,minute:number) => { const d=new Date();d.setHours(hour,minute,0,0);return d.toISOString(); };
function seed() {
  const threads: Record<string,Message[]> = {};
  const snippets = ['That sounds like a plan! 🌿','You have to send me that playlist','Thank you! This made my day ☀️','See you on Saturday?','The little things, you know?','Haha, exactly what I was thinking','Let’s catch up soon!'];
  demoPeople.slice(0,7).forEach((p,i)=>{ threads[p.id]=[{id:crypto.randomUUID(),conversation_id:p.id,sender_id:p.id,client_message_id:crypto.randomUUID(),seq:1,body:snippets[i],created_at:stamp(10-i,42)}]; });
  const chat = [
    ['maya','Hey Alex! How’s your morning going? ☀️',10,24],
    ['you','Slow coffee, good music. Can’t complain. How about you?',10,26],
    ['maya','Pretty much the same! Finally tried that little coffee place you told me about.',10,28],
    ['maya','You were right. Best oat latte in the neighborhood ☕',10,28],
    ['you','I knew you’d love it! The corner by the window is my favorite spot.',10,30],
    ['maya','We should go together sometime this week!',10,32],
    ['you','Absolutely. How does Saturday morning sound?',10,34],
    ['maya','That sounds like a plan! 🌿',10,35]
  ] as const;
  threads.maya=chat.map(([sender,body,h,m],i)=>({id:crypto.randomUUID(),conversation_id:'maya',sender_id:sender,client_message_id:crypto.randomUUID(),seq:i+1,body,created_at:stamp(h,m)}));
  return {threads,reads:{maya:8,jordan:0,sofia:0,oliver:1,ava:1,leo:1,nina:1} as Record<string,number>};
}
type DemoState = ReturnType<typeof seed>;
function loadDemo(): DemoState { try { const s=JSON.parse(localStorage.getItem('yapspace.demo.v1')||'null');if(s?.threads && s?.reads)return s;} catch {} return seed(); }
let demo = loadDemo();
function saveDemo(){localStorage.setItem('yapspace.demo.v1',JSON.stringify(demo));}
export function resetDemo(){demo=seed();saveDemo();}
export function syncDemo(){demo=loadDemo();}
async function rpc<T>(name:string,params:Record<string,unknown>={}):Promise<T>{const {data,error}=await supabase!.rpc(name,params);if(error)throw new Error(error.message);return data as T;}
export const api = {
  async profile():Promise<Profile|null>{const {data,error}=await supabase!.from('profiles').select('id,handle,display_name').eq('id',(await supabase!.auth.getUser()).data.user!.id).maybeSingle();if(error)throw error;return data;},
  async completeProfile(handle:string,name:string){return rpc<Profile>('complete_profile',{p_handle:handle,p_display_name:name});},
  async conversations(isDemo:boolean):Promise<Conversation[]>{
    if(!isDemo) return rpc<Conversation[]>('list_conversations');
    return Object.entries(demo.threads).map(([id,msgs])=>{const p=demoPeople.find(p=>p.id===id)!;const last=msgs.at(-1);return {id,peer_id:p.id,handle:p.handle,display_name:p.display_name,last_body:last?.body||null,last_message_at:last?.created_at||null,last_seq:last?.seq||0,unread_count:msgs.filter(m=>m.sender_id!=='you'&&m.seq>(demo.reads[id]||0)).length};}).sort((a,b)=>(b.last_message_at||'').localeCompare(a.last_message_at||''));
  },
  async messages(isDemo:boolean,id:string,before?:number,after?:number):Promise<Message[]>{
    if(isDemo)return (demo.threads[id]||[]).filter(m=>(!before||m.seq<before)&&(after===undefined||m.seq>after)).slice(after===undefined?-50:0,after===undefined?undefined:100);
    let q=supabase!.from('messages').select('*').eq('conversation_id',id);
    if(before)q=q.lt('seq',before);if(after!==undefined)q=q.gt('seq',after);
    const {data,error}=await q.order('seq',{ascending:after!==undefined}).limit(after===undefined?50:100);if(error)throw error;return (data as Message[]).sort((a,b)=>a.seq-b.seq);
  },
  async send(isDemo:boolean,message:Message):Promise<Message>{
    if(!isDemo)return rpc<Message>('send_message',{p_conversation_id:message.conversation_id,p_client_message_id:message.client_message_id,p_body:message.body});
    const list=demo.threads[message.conversation_id]||[];const old=list.find(m=>m.client_message_id===message.client_message_id);if(old)return old;
    const saved={...message,id:crypto.randomUUID(),seq:(list.at(-1)?.seq||0)+1,status:undefined,created_at:new Date().toISOString()};list.push(saved);demo.threads[message.conversation_id]=list;saveDemo();return saved;
  },
  async read(isDemo:boolean,id:string,seq:number){if(isDemo){demo.reads[id]=Math.max(demo.reads[id]||0,seq);saveDemo();return;}await rpc('advance_read_cursor',{p_conversation_id:id,p_target_seq:seq});},
  async directory(isDemo:boolean,query:string):Promise<Profile[]>{if(isDemo)return demoPeople.filter(p=>(p.display_name+' '+p.handle).toLowerCase().includes(query.toLowerCase()));if(query.trim().length<2)return [];return rpc<Profile[]>('search_profiles',{p_query:query});},
  async start(isDemo:boolean,peer:string):Promise<string>{if(isDemo){demo.threads[peer] ||= [];saveDemo();return peer;}return rpc<string>('get_or_create_direct_conversation',{p_recipient_id:peer});}
};
