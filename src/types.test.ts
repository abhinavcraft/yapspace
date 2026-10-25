import { describe,it,expect } from 'vitest';
import { reconcile,validateMessage,contiguousCursor,type Message } from './types';
const msg=(seq:number,extra:Partial<Message>={}):Message=>({id:`id${seq}`,client_message_id:`key${seq}`,sender_id:'a',conversation_id:'chat',seq,body:'hello',created_at:'2026-10-25T10:00:00Z',...extra});
describe('canonical message reconciliation',()=>{
  it('reconciles optimistic sends with saved rows',()=>{const pending=msg(99,{client_message_id:'key1',status:'pending'});expect(reconcile([pending],[msg(1)])).toEqual([msg(1)]);});
  it('deduplicates repeated and out-of-order events',()=>expect(reconcile([msg(3),msg(1)],[msg(2),msg(1)])).toEqual([msg(1),msg(2),msg(3)]));
  it('does not downgrade a canonical message after a timeout',()=>expect(reconcile([msg(1)],[msg(1,{status:'failed'})])).toEqual([msg(1)]));
  it('keeps sender idempotency keys isolated',()=>expect(reconcile([msg(1)],[msg(2,{sender_id:'b',client_message_id:'key1'})])).toHaveLength(2));
  it('places pending messages after canonical messages',()=>expect(reconcile([msg(0,{status:'pending'})],[msg(1)])).toEqual([msg(1),msg(0,{status:'pending'})]));
  it('never advances the contiguous cursor across a gap',()=>expect(contiguousCursor([msg(1),msg(3)],0)).toBe(1));
  it('advances only when missing rows arrive',()=>expect(contiguousCursor([msg(2),msg(3),msg(4,{status:'pending'})],1)).toBe(3));
});
describe('message input bounds',()=>{
  it('rejects whitespace',()=>expect(validateMessage(' \n\t ')).toBeTruthy());
  it('rejects overlong messages',()=>expect(validateMessage('x'.repeat(4001))).toBeTruthy());
  it('allows precisely 4,000 Unicode characters',()=>expect(validateMessage('🌿'.repeat(4000))).toBeNull());
  it('leaves HTML as plain text for React to escape',()=>expect(validateMessage('<script>alert(1)</script>')).toBeNull());
});
