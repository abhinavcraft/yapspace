import{describe,it,expect}from'vitest';
import{presencePeers}from'./social-activity';
describe('presence subscriptions',()=>{
  it('does not subscribe to the actor twice',()=>expect(presencePeers('me',['me','friend','friend',''])).toEqual(['friend']));
  it('keeps channel ordering stable for an unchanged peer set',()=>expect(presencePeers('me',['b','a'])).toEqual(presencePeers('me',['a','b'])));
  it('bounds channels and keeps the active peer eligible',()=>{const ids=['current',...Array.from({length:100},(_,i)=>'peer'+i)];const result=presencePeers('me',ids);expect(result).toHaveLength(60);expect(result).toContain('current');expect(result).not.toContain('peer99');});
});
