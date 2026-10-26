import {describe,it,expect,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {FriendPicker,FriendsPage,Status} from './Friends';
import type {Relationship} from './types';
vi.mock('./data',()=>({api:{directory:vi.fn()}}));
const accepted:Relationship={id:'one',peer_id:'peer',requester_id:'you',recipient_id:'peer',status:'accepted',display_name:'Sample Friend',handle:'sample.friend'};
const pending:Relationship={...accepted,id:'two',peer_id:'waiting',recipient_id:'waiting',status:'pending',display_name:'Pending Person'};
const noop=async()=>{};
describe('social views',()=>{
  it('keeps an unavailable connection distinct from offline',()=>{const html=renderToStaticMarkup(<Status/>);expect(html).toContain('Status unavailable');expect(html).not.toContain('Offline');});
  it('labels actual online and offline states',()=>{expect(renderToStaticMarkup(<Status value="online"/>)).toContain('Online');expect(renderToStaticMarkup(<Status value="offline"/>)).toContain('Offline');});
  it('shows accepted friends and available presence in the friends workspace',()=>{const html=renderToStaticMarkup(<FriendsPage actor="you" isDemo={false} rows={[accepted]} presence={{peer:'online'}} loading={false} error="" onRequest={noop} onAction={noop} onStart={noop}/>);expect(html).toContain('Sample Friend');expect(html).toContain('presence-online');expect(html).toContain('Message Sample Friend');});
  it('keeps pending people out of the new-conversation friend picker',()=>{const html=renderToStaticMarkup(<FriendPicker rows={[accepted,pending]} onStart={noop} onFindFriends={()=>{}}/>);expect(html).toContain('Sample Friend');expect(html).not.toContain('Pending Person');});
  it('provides an add-friend action in an empty workspace',()=>{const html=renderToStaticMarkup(<FriendsPage actor="you" isDemo={false} rows={[]} presence={{}} loading={false} error="" onRequest={noop} onAction={noop} onStart={noop}/>);expect(html).toContain('Good company starts here.');expect(html).toContain('Find a friend');expect(html).toContain('role="tablist"');});
});
