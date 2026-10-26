import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
export async function testConcurrency(connectionString){
  const {Client}=await import('pg');const admin=new Client({connectionString});const clients=[new Client({connectionString}),new Client({connectionString}),new Client({connectionString})];
  await admin.connect();await Promise.all(clients.map(c=>c.connect()));
  // Use fresh identities so this independent-connection fixture cannot collide
  // with users created by the main database test suite.
  const D=randomUUID(),E=randomUUID();
  try{
    await admin.query('insert into auth.users values($1),($2)',[D,E]);
    for(const [i,id] of [D,E,D].entries()){await clients[i].query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await clients[i].query('set role authenticated');}
    await clients[0].query("select public.complete_profile('concurrent.d','Concurrent D')");await clients[1].query("select public.complete_profile('concurrent.e','Concurrent E')");
    const pairs=await Promise.all([clients[0].query('select public.get_or_create_direct_conversation($1) id',[E]),clients[1].query('select public.get_or_create_direct_conversation($1) id',[D])]);
    const chat=pairs[0].rows[0].id;assert.equal(pairs[1].rows[0].id,chat);console.log('PASS independent connections create one canonical pair');
    const key=randomUUID();const retries=await Promise.all([clients[0],clients[2]].map(c=>c.query('select * from public.send_message($1,$2,$3)',[chat,key,'Retry fixture'])));assert.equal(retries[0].rows[0].id,retries[1].rows[0].id);console.log('PASS concurrent same-key sends persist exactly once');
    await Promise.all(Array.from({length:10},(_,i)=>clients[i%2].query('select * from public.send_message($1,$2,$3)',[chat,randomUUID(),'Concurrent fixture '+i])));
    await clients[0].query('begin');await clients[0].query('select public.send_message($1,$2,$3)',[chat,randomUUID(),'Rollback fixture']);await clients[0].query('rollback');
    await clients[1].query('select public.send_message($1,$2,$3)',[chat,randomUUID(),'After rollback fixture']);
    const rows=(await admin.query('select seq from public.messages where conversation_id=$1 order by seq',[chat])).rows;assert.deepEqual(rows.map(r=>Number(r.seq)),Array.from({length:12},(_,i)=>i+1));console.log('PASS concurrent sequence allocation and rollback have no duplicate or missing sequences');
  }finally{await Promise.allSettled(clients.map(c=>c.end()));await admin.end();}
}
