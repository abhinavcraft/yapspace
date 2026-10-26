import { createInterface } from 'node:readline';
// Optional owner-private Site dispatch authorization is accepted on stdin only.
// It is never logged, written to a file, or included in shell arguments.
console.log('Ready for live-check JSON on stdin. Authorization is not logged.');
const tty=process.stdin.isTTY;if(tty)process.stdin.setRawMode(true);
const lines=createInterface({input:process.stdin,terminal:false});let input='';for await(const line of lines){input=line;break;}lines.close();if(tty)process.stdin.setRawMode(false);const config=JSON.parse(input||'{}');
const origin=config.url||'https://yapspace-agnivya.vercel.app';
const headers=config.authorization?{'OAI-Sites-Authorization':'Bearer '+config.authorization}:{};
let failed=false;
try{
 const response=await fetch(origin,{headers,redirect:'manual',signal:AbortSignal.timeout(15000)});
 if(response.status!==200){console.error(`Live site returned ${response.status}; owner authentication or routing needs verification.`);process.exitCode=1;}
 else{
 const body=await response.text();if(!body.includes('YapSpace')||!body.includes('/assets/')){failed=true;console.error('The response is not the built YapSpace app shell.');}
 const csp=response.headers.get('content-security-policy')||'';
 for(const [name,ok] of [['Content-Security-Policy',csp.includes("script-src 'self'")&&csp.includes("object-src 'none'")],['X-Content-Type-Options',response.headers.get('x-content-type-options')==='nosniff'],['Referrer-Policy',response.headers.get('referrer-policy')==='no-referrer']]){console.log(`${ok?'OK':'MISSING'} ${name}`);if(!ok)failed=true;}
 const health=await fetch(new URL('/health.json',origin),{headers,redirect:'manual',signal:AbortSignal.timeout(15000)});if(health.status===200&&(await health.json()).app==='YapSpace')console.log('OK static health endpoint');else{console.error('Static health endpoint was not verified.');failed=true;}
 process.exitCode=failed?1:0;
 }
}catch{console.error('Live HTTP verification could not complete. No release readiness is implied.');process.exitCode=1;}
