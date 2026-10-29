import { readFile, writeFile, rename } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

export const stores = [
  ['carrefour','Carrefour','https://www.carrefour.fr/catalogues'],
  ['leclerc','E.Leclerc','https://www.e.leclerc/catalogue'],
  ['intermarche','Intermarché','https://www.intermarche.com/catalogues'],
  ['auchan','Auchan','https://www.auchan.fr/catalogue/'],
  ['lidl','Lidl','https://www.lidl.fr/c/catalogues-en-ligne/s10017753'],
  ['aldi','ALDI','https://www.aldi.fr/catalogue.html'],
  ['superu','Magasins U','https://www.coursesu.com/catalogues'],
  ['monoprix','Monoprix','https://www.monoprix.fr/'],
  ['franprix','Franprix','https://www.franprix.fr/'],
  ['biocoop','Biocoop','https://www.biocoop.fr/'],
  ['grandfrais','Grand Frais','https://www.grandfrais.com/'],
].map(([id,name,url])=>({id,name,url}));
const domains=['bonial.fr','carrefour.fr','e.leclerc','leclerc.fr','intermarche.com','auchan.fr','lidl.fr','aldi.fr','coursesu.com','magasins-u.com','monoprix.fr','franprix.fr','biocoop.fr','grandfrais.com'];
export function allowed(raw) {
  try { const u=new URL(raw); return u.protocol==='https:' && !u.username && !u.password && (!u.port || u.port==='443') && domains.some(d=>u.hostname===d||u.hostname.endsWith('.'+d)); } catch { return false; }
}
const clean=s=>String(s??'').replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#(?:x([0-9a-f]+)|(\d+));/gi,(_,hex,decimal)=>{const n=parseInt(hex??decimal,hex?16:10);return n>=0&&n<=0x10ffff?String.fromCodePoint(n):'';}).replace(/\s+/g,' ').trim();
export function storeId(name) {
  const n=clean(name).normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().replace(/[^a-z0-9]/g,'');
  if(n.includes('leclerc')) return 'leclerc';
  if(n.includes('superu')||n.includes('systemeu')||n.includes('magasinsu')) return 'superu';
  return stores.find(s=>n.includes(s.id))?.id??null;
}
const date=value=> {
  const text=String(value??'');if(!/^\d{4}-\d{2}-\d{2}/.test(text)||Number.isNaN(Date.parse(text)))return null;
  return text.length===10?text:new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(text));
};
function entry(store,title,url,from,to,source) {
  if(!store||!allowed(url)) return null;
  return {id:createHash('sha256').update(store+'|'+url).digest('hex').slice(0,32),storeId:store,title:clean(title).slice(0,150)||'Catalogue',url,validFrom:date(from),validUntil:date(to),source,stale:false};
}

/** Parse data as JSON/HTML only. No eval, browser scripts or synthetic products. */
export function parseDocument(html,url,forcedStore=null) {
  const result=[];
  for(const match of html.matchAll(/<script\b[^>]*\bid=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    let data; try { data=JSON.parse(match[1]); } catch { continue; }
    const info=data.props?.pageProps?.pageInformation;
    if(info?.brochures && new URL(url).hostname.endsWith('bonial.fr')) {
      for(const b of [...(info.brochures.viewer??[]),...(info.brochures.publisher??[])]) {
        if(b.type!=='BROCHURE' || !b.contentId)continue;
        const id=storeId(b.publisher?.name);
        if(forcedStore && id!==forcedStore)continue;
        const item=entry(id,b.title,url,b.validFrom,b.validUntil,url);
        if(item)result.push({...item,id:createHash('sha256').update(id+'|'+b.contentId).digest('hex').slice(0,32),linkType:'sourcePage'});
      }
    }
    let visited=0;
    function walk(value,depth=0) {
      if(!value||typeof value!=='object'||depth>20||++visited>20000) return;
      if(!Array.isArray(value)) {
        const name=value.publisherName??value.retailerName??value.publisher?.name;
        const link=value.publishedUrl??value.pdfUrl??value.catalogueUrl;
        if(link&&(name||forcedStore)) {
          const id=storeId(name)??forcedStore;
          const item=entry(id,value.title??`Catalogue ${name??id}`,new URL(link,url).href,value.validFrom??value.startDate,value.validUntil??value.validTo??value.endDate,url);
          if(item) result.push(item);
        }
      }
      for(const child of Object.values(value)) walk(child,depth+1);
    }
    walk(data);
  }
  for(const match of html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    let link; try { link=new URL(clean(match[1]),url); } catch { continue; }
    // Generic landing pages are fallbacks, never claimed to be an extracted edition.
    if(!/\.pdf$/i.test(link.pathname) && !/\/(?:brochures|catalogue)\/[\w-]{6,}/i.test(link.pathname) && !(forcedStore==='lidl' && /\/l\/catalogue-de-la-semaine\//.test(link.pathname))) continue;
    if(link.href===url) continue;
    if(forcedStore==='auchan' && !/\/catalogue\/\d+-[a-z0-9]+/i.test(link.pathname) && !/\.pdf$/i.test(link.pathname)) continue;
    const title=clean(match[2]);
    const id=forcedStore??storeId(title);
    const dates=title.match(/du\s+(\d{2})\/(\d{2})\s+au\s+(\d{2})\/(\d{2})\/(\d{4})/i);
    const from=dates?`${Number(dates[2])>Number(dates[4])?Number(dates[5])-1:dates[5]}-${dates[2]}-${dates[1]}`:null;
    const to=dates?`${dates[5]}-${dates[4]}-${dates[3]}`:null;
    const item=entry(id,title||`Catalogue ${id}`,link.href,from,to,url);
    if(item) result.push(item);
  }
  return [...new Map(result.map(x=>[x.id,x])).values()];
}

export function mergeFeed(results,previous=[],now=new Date()) {
  const today=now.toISOString().slice(0,10);
  const catalogues=[];
  const status=[];
  for(const store of stores) {
    const candidates=results.flatMap(r=>r.items??[]).filter(x=>x.storeId===store.id&&allowed(x.url)&&(!x.validUntil||x.validUntil>=today)&&(!x.validFrom||x.validFrom<=today));
    const fresh=[...new Map(candidates.map(x=>[x.id,x])).values()];
    const old=previous.filter(x=>x.storeId===store.id&&!String(x.id).startsWith('demo')&&allowed(x.url)&&x.fetchedAt&&Date.parse(x.fetchedAt)>=now.getTime()-14*86400000&&(!x.validUntil||x.validUntil>=today));
    const selected=fresh.length?fresh.map(x=>({...x,fetchedAt:now.toISOString(),stale:false})):old.map(x=>({...x,stale:true}));
    catalogues.push(...selected);
    status.push({storeId:store.id,name:store.name,officialUrl:store.url,status:fresh.length?'ok':selected.length?'stale':'unavailable',message:fresh.length?'Catalogues récupérés':results.find(r=>r.storeId===store.id)?.error??(selected.length?'Dernière récupération conservée':'Aucun catalogue extrait')});
  }
  return {schemaVersion:1,generatedAt:now.toISOString(),locationLabel:`${process.env.CITY??'Paris'} ${process.env.POSTAL_CODE??'75003'}`,catalogues,stores:status};
}

async function fetchDocument(url,storeId=null) {
  try {
    const response=await fetch(url,{headers:{'User-Agent':'CourseoCatalogues/0.2 (+https://github.com/colinos10/courseo-catalogues)','Accept':'text/html','Accept-Language':'fr-FR'},signal:AbortSignal.timeout(15000),redirect:'follow'});
    if(!response.ok) return {storeId,items:[],error:`Source indisponible (HTTP ${response.status})`};
    if(!allowed(response.url)) return {storeId,items:[],error:'Redirection vers une source non autorisée'};
    let bytes=0;const chunks=[];
    for await(const chunk of response.body) { bytes+=chunk.byteLength;if(bytes>3_000_000) throw new Error('Page trop volumineuse');chunks.push(chunk); }
    return {storeId,items:parseDocument(Buffer.concat(chunks).toString('utf8'),response.url,storeId)};
  } catch { return {storeId,items:[],error:'Source indisponible ou délai dépassé'}; }
}
export async function main() {
  const output=process.env.OUTPUT??'catalogues.json';
  let previous=[];try { const old=JSON.parse(await readFile(output,'utf8'));previous=Array.isArray(old)?old:old.catalogues??[]; } catch { /* First run */ }
  const shelf=new URL('https://www.bonial.fr/shelf');
  for(const [k,v] of Object.entries({lat:process.env.LATITUDE??'48.8558',lng:process.env.LONGITUDE??'2.3494',zip:process.env.POSTAL_CODE??'75003',city:process.env.CITY??'Paris'})) shelf.searchParams.set(k,v);
  const slugs={carrefour:'Carrefour',leclerc:'E-Leclerc',intermarche:'Intermarche',auchan:'Auchan',lidl:'Lidl',aldi:'Aldi',superu:'Super-U',monoprix:'Monoprix',franprix:'Franprix',grandfrais:'Grand-Frais'};
  const sources=[{url:shelf.href,id:null},...stores,...Object.entries(slugs).map(([id,slug])=>({id,url:'https://www.bonial.fr/Enseignes/'+slug}))];
  const results=[];
  // At most three public pages at once. Never retry a denied request or bypass a block.
  for(let i=0;i<sources.length;i+=3) results.push(...await Promise.all(sources.slice(i,i+3).map(s=>fetchDocument(s.url,s.id))));
  const feed=mergeFeed(results,previous);
  const temporary=output+'.tmp';await writeFile(temporary,JSON.stringify(feed,null,2)+'\n');await rename(temporary,output);
  console.log(JSON.stringify({catalogues:feed.catalogues.length,stores:feed.stores.map(s=>({store:s.storeId,status:s.status,message:s.message}))},null,2));
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) await main();
