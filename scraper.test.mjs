import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseDocument,mergeFeed,allowed,storeId} from './scraper.mjs';
test('recognises brands including accents',()=>{
  assert.equal(storeId('Intermarché'), 'intermarche');assert.equal(storeId('E.Leclerc'),'leclerc');assert.equal(storeId('Magasins U'),'superu');assert.equal(storeId('Inconnu'),null);
});
test('accepts only trusted HTTPS catalogue URLs',()=>{
  assert.equal(allowed('https://www.carrefour.fr/a.pdf'),true);assert.equal(allowed('http://www.carrefour.fr/a.pdf'),false);assert.equal(allowed('https://carrefour.fr.attacker.test/a'),false);assert.equal(allowed('javascript:alert(1)'),false);
});
test('parses observed Next JSON without inventing prices',()=>{
  const html='<script id="__NEXT_DATA__">'+JSON.stringify({props:{pageProps:{brochures:[{publisherName:'Carrefour',publishedUrl:'https://www.bonial.fr/brochures/123456',validUntil:'2026-11-05T20:00:00Z'}]}}})+'</script>';
  const result=parseDocument(html,'https://www.bonial.fr/shelf');
  assert.equal(result.length,1);assert.equal(result[0].storeId,'carrefour');assert.equal(result[0].validUntil,'2026-11-05');assert.equal('products' in result[0],false);
});
test('keeps direct PDFs and ignores generic catalogue links',()=>{
  const result=parseDocument('<a href="/catalogues">Catalogues</a><a href="/offres.pdf">Nos offres</a>','https://www.carrefour.fr/catalogues','carrefour');
  assert.equal(result.length,1);assert.equal(result[0].url,'https://www.carrefour.fr/offres.pdf');assert.equal(result[0].validUntil,null);
});
test('errors never generate demonstration prices or resurrect expired brochures',()=>{
  const now=new Date('2026-10-29T12:00:00Z');
  const old=[{id:'demo_carrefour',storeId:'carrefour',url:'https://www.carrefour.fr/catalogues'},{id:'old',storeId:'lidl',url:'https://www.lidl.fr/a.pdf',validUntil:'2026-10-28',fetchedAt:now.toISOString()}];
  const feed=mergeFeed([],old,now);assert.equal(feed.catalogues.length,0);assert.equal(feed.stores.length,11);assert.equal(feed.stores.every(s=>s.status==='unavailable'),true);
});
test('retains recent last known links while marking them stale',()=>{
  const old=[{id:'old',storeId:'lidl',url:'https://www.lidl.fr/a.pdf',validUntil:'2026-11-02',fetchedAt:'2026-10-28T12:00:00Z'}];
  const feed=mergeFeed([],old,new Date('2026-10-29T12:00:00Z'));assert.equal(feed.catalogues[0].stale,true);
});
test('parses the current Lidl leaflet link structure',()=>{
  const result=parseDocument('<a class="flyer" href="https://www.lidl.fr/l/catalogue-de-la-semaine/du-29-10-au-04-11-les-promos-de-la-semaine/ar/0?lf=HHZ">Du 29/10 au 04/11 Les promos de la semaine</a>','https://www.lidl.fr/c/catalogues-en-ligne/s10017753','lidl');
  assert.equal(result.length,1);assert.equal(result[0].storeId,'lidl');assert.equal(result[0].validUntil,null);
});
test('Auchan categories are excluded and explicit dates are extracted',()=>{
 const result=parseDocument('<a href="/catalogue/hypermarche">Hypermarch&#xE9;s</a><a href="/catalogue/4025-Ml0oKsnG">Parapharmacie, beaut&#xE9; Du 27/10 au 29/11/2026</a>','https://www.auchan.fr/catalogue/','auchan');
 assert.equal(result.length,1);assert.match(result[0].title,/beauté/);assert.equal(result[0].validFrom,'2026-10-27');assert.equal(result[0].validUntil,'2026-11-29');
});
test('Bonial publisher brochures retain identity and use French local dates',()=>{
 const html='<script id="__NEXT_DATA__">'+JSON.stringify({props:{pageProps:{pageInformation:{brochures:{publisher:[{type:'BROCHURE',contentId:'abc',title:'Carrefour semaine',publisher:{name:'Carrefour'},validFrom:'2026-10-26T23:00:00.000+0000',validUntil:'2026-11-09T22:55:00.000+0000'}]}}}}})+'</script>';
 const result=parseDocument(html,'https://www.bonial.fr/Enseignes/Carrefour','carrefour');
 assert.equal(result.length,1);assert.equal(result[0].validFrom,'2026-10-27');assert.equal(result[0].linkType,'sourcePage');assert.equal(result[0].url,'https://www.bonial.fr/Enseignes/Carrefour');
});
