export function allowedOrigin(origin:string|null,configured:string):string|null{
  if(!origin)return null;
  return configured.split(',').map(x=>x.trim()).filter(Boolean).includes(origin)?origin:null;
}
export async function readBoundedJSON(request:Request,maximum=8192):Promise<unknown>{
  if(!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))throw new Error('content-type');
  if(Number(request.headers.get('content-length')||0)>maximum)throw new Error('too-large');
  const reader=request.body?.getReader();if(!reader)throw new Error('json');
  const chunks:Uint8Array[]=[];let size=0;
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>maximum){await reader.cancel();throw new Error('too-large');}chunks.push(value);}}
  finally{reader.releaseLock();}
  const bytes=new Uint8Array(size);let at=0;for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.byteLength;}
  try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw new Error('json');}
}
