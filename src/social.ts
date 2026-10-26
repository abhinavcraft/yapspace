import {useCallback,useEffect,useRef,useState} from 'react';
import type {RealtimeChannel} from '@supabase/supabase-js';
import {api,supabase} from './data';
import type {FriendAction,PresenceStatus,Relationship} from './types';
import {presencePeers} from './social-activity';

export function useFriends(actor:string|null,isDemo:boolean){
  const [rows,setRows]=useState<Relationship[]>([]),[loading,setLoading]=useState(false),[error,setError]=useState('');
  const generation=useRef(0);
  const refresh=useCallback(async()=>{const run=generation.current;if(!actor)return;try{const result=await api.relationships(isDemo,actor);if(run===generation.current){setRows(result);setError('');}}catch(e){if(run===generation.current)setError((e as Error).message);}finally{if(run===generation.current)setLoading(false);}},[actor,isDemo]);
  useEffect(()=>{generation.current++;setRows([]);setError('');if(!actor)return;setLoading(true);void refresh();let stopped=false;let channel:RealtimeChannel|undefined;
    if(!isDemo&&supabase)void supabase.realtime.setAuth().then(()=>{if(stopped)return;channel=supabase!.channel('social:'+actor,{config:{private:true}}).on('broadcast',{event:'friends'},()=>void refresh()).subscribe(status=>{if(status==='SUBSCRIBED')void refresh();});}).catch(()=>{});
    const recover=()=>{if(document.visibilityState==='visible')void refresh();};const timer=setInterval(recover,30000);window.addEventListener('focus',recover);
    return()=>{stopped=true;generation.current++;clearInterval(timer);window.removeEventListener('focus',recover);if(channel)void supabase!.removeChannel(channel);};
  },[actor,isDemo,refresh]);
  const request=async(peer:string)=>{await api.requestFriend(isDemo,peer,actor||undefined);await refresh();};
  const respond=async(peer:string,action:FriendAction)=>{await api.friendAction(isDemo,peer,action,actor||undefined);await refresh();};
  return {rows,loading,error,refresh,request,respond};
}

export function usePresence(actor:string|null,peerIds:string[],isDemo:boolean){
  const [states,setStates]=useState<Record<string,PresenceStatus>>({});
  const peers=presencePeers(actor,peerIds).join(',');
  useEffect(()=>{if(!actor||isDemo||!supabase)return;let stopped=false;let own:RealtimeChannel|undefined;
    void supabase.realtime.setAuth().then(()=>{if(stopped)return;own=supabase!.channel('presence:'+actor,{config:{private:true,presence:{key:actor}}}).on('presence',{event:'sync'},()=>{}).subscribe(status=>{if(status==='SUBSCRIBED')void own?.track({connected:true});});}).catch(()=>{});
    return()=>{stopped=true;if(own){void own.untrack();void supabase!.removeChannel(own);}};
  },[actor,isDemo]);
  useEffect(()=>{setStates({});if(!actor||!peers)return;if(isDemo){setStates(Object.fromEntries(peers.split(',').map((id,i)=>[id,i%3===0?'online':'offline'])));return;}
    let stopped=false;const channels:RealtimeChannel[]=[];
    void supabase!.realtime.setAuth().then(()=>{if(stopped)return;for(const peer of peers.split(',')){const channel=supabase!.channel('presence:'+peer,{config:{private:true}});channel.on('presence',{event:'sync'},()=>{if(!stopped)setStates(prev=>({...prev,[peer]:Object.values(channel.presenceState()).some(entries=>entries.length>0)?'online':'offline'}));}).subscribe(status=>{if(status!=='SUBSCRIBED'&&!stopped)setStates(prev=>({...prev,[peer]:'unknown'}));});channels.push(channel);}}).catch(()=>{});
    return()=>{stopped=true;for(const channel of channels)void supabase!.removeChannel(channel);};
  },[actor,isDemo,peers]);
  return states;
}

export function useTyping(actor:string|null,conversation:string|null,peer:string|null,isDemo:boolean){
  const [typing,setTyping]=useState(false);const sender=useRef<RealtimeChannel|null>(null),ready=useRef(false),lastSent=useRef(0),stopTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  useEffect(()=>{setTyping(false);ready.current=false;lastSent.current=0;if(!actor||!conversation||!peer||isDemo||!supabase)return;let stopped=false;let expires:ReturnType<typeof setTimeout>|undefined;const channels:RealtimeChannel[]=[];
    const stop=()=>{if(ready.current)void sender.current?.send({type:'broadcast',event:'typing',payload:{active:false}});if(stopTimer.current)clearTimeout(stopTimer.current);};
    void supabase.realtime.setAuth().then(()=>{if(stopped)return;const own=supabase!.channel('typing:'+conversation+':'+actor,{config:{private:true}}).on('broadcast',{event:'typing'},()=>{});sender.current=own;own.subscribe(status=>{ready.current=status==='SUBSCRIBED';});channels.push(own);
      const remote=supabase!.channel('typing:'+conversation+':'+peer,{config:{private:true}}).on('broadcast',{event:'typing'},event=>{if(stopped)return;if(expires)clearTimeout(expires);const active=event.payload?.active===true;setTyping(active);if(active)expires=setTimeout(()=>{if(!stopped)setTyping(false);},5000);}).subscribe(status=>{if(status!=='SUBSCRIBED'&&!stopped)setTyping(false);});channels.push(remote);
    }).catch(()=>{});
    const hidden=()=>{if(document.visibilityState==='hidden')stop();};window.addEventListener('blur',stop);window.addEventListener('offline',stop);document.addEventListener('visibilitychange',hidden);
    return()=>{stopped=true;stop();ready.current=false;sender.current=null;if(expires)clearTimeout(expires);for(const channel of channels)void supabase!.removeChannel(channel);window.removeEventListener('blur',stop);window.removeEventListener('offline',stop);document.removeEventListener('visibilitychange',hidden);};
  },[actor,conversation,peer,isDemo]);
  const emit=useCallback((active:boolean)=>{if(!ready.current)return;const now=Date.now();if(!active||now-lastSent.current>1800){void sender.current?.send({type:'broadcast',event:'typing',payload:{active}});lastSent.current=now;}if(stopTimer.current)clearTimeout(stopTimer.current);if(active)stopTimer.current=setTimeout(()=>{if(ready.current)void sender.current?.send({type:'broadcast',event:'typing',payload:{active:false}});},2500);},[]);
  return {typing,emit};
}
