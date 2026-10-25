/** Use one configured callback for production emails, even from a preview URL. */
export function authRedirectUrl(configured:string|undefined,currentOrigin:string):string {
  const target=new URL(configured||currentOrigin);
  if(target.username||target.password||target.search||target.hash||target.pathname!=='/')throw new Error('Invalid app URL configuration.');
  if(target.protocol!=='https:'&&!(target.protocol==='http:'&&['localhost','127.0.0.1'].includes(target.hostname)))throw new Error('The app URL must use HTTPS.');
  return target.origin+'/';
}
export function emailRedirectUrl():string {
  const env=(import.meta as unknown as {env:Record<string,string>}).env;
  return authRedirectUrl(env.VITE_APP_URL,window.location.origin);
}
