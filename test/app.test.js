import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../server/app.js';

const config={NODE_ENV:'test',SESSION_SECRET:'test-secret-for-integration-tests-1234567890',USERS_JSON:JSON.stringify([{username:'christian',password:'test-password-1234'},{username:'familia',password:'another-password-1234'}]),TURSO_DATABASE_URL:'file::memory:'};
test('Autenticación, lista compartida, CRUD, conflictos y persistencia de registros',async()=>{
 const {app,db}=await createApp(config);const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
 const url='http://127.0.0.1:'+server.address().port;
 let cookie='';
 async function request(route,method='GET',body,custom={}){return fetch(url+route,{method,headers:{'X-Requested-With':'en-casa','Content-Type':'application/json',Cookie:cookie,...custom},body:body===undefined?undefined:JSON.stringify(body)})}
 try{
  assert.equal((await request('/api/products')).status,401);
  assert.equal((await request('/api/login','POST',{username:'christian',password:'incorrect'})).status,401);
  assert.equal((await request('/api/login','POST',{username:'christian',password:'test-password-1234'},{'X-Requested-With':''})).status,403);
  let r=await request('/api/login','POST',{username:'christian',password:'test-password-1234'});assert.equal(r.status,200);cookie=r.headers.get('set-cookie').split(';')[0];const firstCookie=cookie;
  assert.match(r.headers.get('set-cookie'),/HttpOnly/);assert.match(r.headers.get('set-cookie'),/SameSite=Strict/);
  assert.equal((await request('/api/me')).status,200);
  assert.equal((await request('/api/products','POST',{name:"', DROP TABLE products; --",category:'Otros',quantity:-1,price:1,done:false})).status,400);
  const product={name:'Leche',category:'Lácteos y huevos',quantity:2,price:1.25,done:false};
  r=await request('/api/products','POST',product);assert.equal(r.status,201);const item=await r.json();assert.equal(item.price,1.25);assert.equal(item.version,1);
  r=await request('/api/login','POST',{username:'familia',password:'another-password-1234'});cookie=r.headers.get('set-cookie').split(';')[0];
  r=await request('/api/products');assert.equal((await r.json())[0].name,'Leche');
  r=await request('/api/products','POST',{...item,name:'Leche sin lactosa'});assert.equal(r.status,200);const updated=await r.json();assert.equal(updated.version,2);
  cookie=firstCookie;
  assert.equal((await request('/api/products','POST',{...item,name:'Edición antigua'})).status,409);
  assert.equal((await request('/api/products/'+item.id+'?version=1','DELETE')).status,409);
  assert.equal((await request('/api/products/'+item.id,'PATCH',{done:true},{Origin:'https://evil.example'})).status,403);
  r=await request('/api/products/'+item.id,'PATCH',{done:true});assert.equal(r.status,200);const bought=await r.json();assert.equal(bought.done,true);assert.equal(bought.name,'Leche sin lactosa');
  r=await request('/api/products/'+item.id+'?version='+bought.version,'DELETE');assert.equal(r.status,200);
  assert.deepEqual(await (await request('/api/products')).json(),[]);
  const tampered=cookie.slice(0,-4)+'fake';assert.equal((await request('/api/me','GET',undefined,{Cookie:tampered})).status,401);
  r=await request('/api/logout','POST');assert.equal(r.status,200);assert.match(r.headers.get('set-cookie'),/Expires=Thu, 01 Jan 1970/);
  assert.equal((await request('/api/me','GET',undefined,{Cookie:''})).status,401);
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));db.close()}
});
test('Producción impide una base local que Render podría borrar',async()=>{
 await assert.rejects(()=>createApp({...config,NODE_ENV:'production'}),/remota/);
});
