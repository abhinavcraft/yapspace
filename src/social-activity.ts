/** Bound subscriptions per tab; current chat is first in the caller's list. */
export function presencePeers(actor:string|null,ids:string[]):string[]{return [...new Set(ids)].filter(id=>id&&id!==actor).slice(0,60).sort();}
