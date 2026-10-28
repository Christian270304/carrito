import express from 'express';
import helmet from 'helmet';
import {rateLimit} from 'express-rate-limit';
import {createClient} from '@libsql/client';
import {randomBytes,randomUUID,scryptSync,timingSafeEqual,createHmac} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const categories=['Fruta y verdura','Lácteos y huevos','Carne y pescado','Despensa','Panadería','Bebidas','Limpieza','Otros'];
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const fail=(res,status,message)=>res.status(status).json({error:message});
function equal(a,b){const aa=Buffer.from(a),bb=Buffer.from(b);return aa.length===bb.length&&timingSafeEqual(aa,bb)}

export async function createApp(config=process.env){
  const production=config.NODE_ENV==='production';
  const secret=config.SESSION_SECRET;
  if(!secret||secret.length<32)throw new Error('SESSION_SECRET debe tener al menos 32 caracteres. Consulta README.md.');
  let raw;
  try{raw=JSON.parse(config.USERS_JSON||'')}catch{throw new Error('USERS_JSON debe contener un array JSON de usuarios y contraseñas.');}
  if(!Array.isArray(raw)||raw.length===0||raw.length>30)throw new Error('Configura entre 1 y 30 usuarios en USERS_JSON.');
  const users=new Map();
  for(const user of raw){
    const username=typeof user.username==='string'?user.username.trim().toLowerCase():'';
    if(!/^[a-z0-9_-]{3,32}$/.test(username)||typeof user.password!=='string'||user.password.length<12||user.password.length>200||users.has(username))throw new Error('Cada usuario necesita un nombre único (3-32 letras minúsculas, números, _ o -) y una contraseña de 12-200 caracteres.');
    const salt=randomBytes(16);const hash=scryptSync(user.password,salt,64);
    // Un cambio de contraseña invalida las sesiones anteriores de esa cuenta.
    const revision=createHmac('sha256',secret).update(username+'\0'+user.password).digest('hex');
    users.set(username,{salt,hash,revision});
  }
  raw=null;
  if(!config.TURSO_DATABASE_URL)throw new Error('Falta TURSO_DATABASE_URL.');
  if(production&&(!config.TURSO_DATABASE_URL.startsWith('libsql://')&&!config.TURSO_DATABASE_URL.startsWith('https://')))throw new Error('En producción utiliza una base de datos Turso remota, no un archivo local.');
  if(production&&!config.TURSO_AUTH_TOKEN)throw new Error('Falta TURSO_AUTH_TOKEN.');
  const db=createClient({url:config.TURSO_DATABASE_URL,authToken:config.TURSO_AUTH_TOKEN||undefined});
  await db.execute(`CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL,
    quantity REAL NOT NULL CHECK(quantity>0), price_cents INTEGER NOT NULL CHECK(price_cents>=0),
    done INTEGER NOT NULL DEFAULT 0, version INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
  const app=express();
  if(production)app.set('trust proxy',1); // Render termina HTTPS en su proxy.
  app.disable('x-powered-by');
  app.use(helmet({contentSecurityPolicy:{directives:{'script-src':["'self'"],'style-src':["'self'","'unsafe-inline'"],'img-src':["'self'",'data:'],'connect-src':["'self'"],'upgrade-insecure-requests':production?[]:null}},strictTransportSecurity:production?undefined:false}));
  app.use(express.json({limit:'16kb'}));
  app.use('/api',(req,res,next)=>{res.set('Cache-Control','no-store');next()});
  app.use('/api',(req,res,next)=>{
    if(!['GET','HEAD','OPTIONS'].includes(req.method)&&req.get('X-Requested-With')!=='en-casa')return fail(res,403,'Petición no permitida.');
    // No se habilita CORS. El encabezado exige preflight en peticiones de otros orígenes.
    const origin=req.get('origin');
    if(!['GET','HEAD','OPTIONS'].includes(req.method)&&origin){try{if(new URL(origin).host!==req.get('host'))return fail(res,403,'Origen no permitido.')}catch{return fail(res,403,'Origen no válido.')}}
    next();
  });
  const sign=data=>createHmac('sha256',secret).update(data).digest('base64url');
  function getUser(req){
    try{
      const cookie=(req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith('en_casa_session='));
      if(!cookie)return null;
      const token=cookie.slice('en_casa_session='.length);const [data,signature,...extra]=token.split('.');
      if(extra.length||!signature||!equal(signature,sign(data)))return null;
      const payload=JSON.parse(Buffer.from(data,'base64url').toString());
      if(!Number.isFinite(payload.exp)||payload.exp<Date.now()||users.get(payload.username)?.revision!==payload.revision)return null;
      return payload;
    }catch{return null;}
  }
  const cookieOptions={httpOnly:true,secure:production,sameSite:'strict',path:'/'};
  const loginLimiter=rateLimit({windowMs:15*60*1000,limit:15,standardHeaders:'draft-7',legacyHeaders:false,handler:(_req,res)=>fail(res,429,'Demasiados intentos. Espera 15 minutos.')});
  app.post('/api/login',loginLimiter,(req,res)=>{
    const username=String(req.body?.username||'').trim().toLowerCase();
    const password=typeof req.body?.password==='string'?req.body.password:'';
    if(password.length>200)return fail(res,401,'Usuario o contraseña incorrectos.');
    const user=users.get(username);
    const computed=scryptSync(password,user?.salt||Buffer.alloc(16),64);
    if(!user||!timingSafeEqual(computed,user.hash))return fail(res,401,'Usuario o contraseña incorrectos.');
    const data=Buffer.from(JSON.stringify({username,revision:user.revision,exp:Date.now()+7*86400000,nonce:randomBytes(16).toString('hex')})).toString('base64url');
    res.cookie('en_casa_session',data+'.'+sign(data),{...cookieOptions,maxAge:7*86400000});
    res.json({username});
  });
  app.post('/api/logout',(_req,res)=>{res.clearCookie('en_casa_session',cookieOptions);res.json({ok:true})});
  app.get('/api/health',(_req,res)=>res.json({ok:true}));
  app.use('/api',(req,res,next)=>{const user=getUser(req);if(!user)return fail(res,401,'Inicia sesión para acceder a la lista.');req.user=user;next()});
  app.get('/api/me',(req,res)=>res.json({username:req.user.username}));
  const mapRow=p=>({id:p.id,name:p.name,category:p.category,quantity:Number(p.quantity),price:Number(p.price_cents)/100,done:!!p.done,version:Number(p.version)});
  app.get('/api/products',async(_req,res)=>{const result=await db.execute('SELECT * FROM products ORDER BY created_at, id');res.json(result.rows.map(mapRow))});
  function validate(p){return p&&typeof p.name==='string'&&p.name.trim().length>0&&p.name.trim().length<=100&&categories.includes(p.category)&&Number.isFinite(p.quantity)&&p.quantity>=0.01&&p.quantity<=100000&&Number.isFinite(p.price)&&p.price>=0&&p.price<=1000000&&typeof p.done==='boolean'}
  app.post('/api/products',async(req,res)=>{
    const p=req.body;
    if(!validate(p))return fail(res,400,'Revisa el nombre, la categoría, la cantidad y el precio.');
    if(p.id){
      if(typeof p.id!=='string'||!Number.isInteger(p.version)||p.version<1)return fail(res,400,'Versión de producto no válida.');
      const result=await db.execute({sql:'UPDATE products SET name=?,category=?,quantity=?,price_cents=?,done=?,version=version+1 WHERE id=? AND version=? RETURNING *',args:[p.name.trim(),p.category,p.quantity,Math.round(p.price*100),p.done?1:0,p.id,p.version]});
      if(!result.rows.length)return fail(res,409,'Otra persona ha modificado o eliminado este producto. Cierra la ventana y ábrelo de nuevo para editar la versión actual.');
      return res.json(mapRow(result.rows[0]));
    }
    const result=await db.execute({sql:'INSERT INTO products(id,name,category,quantity,price_cents,done) VALUES(?,?,?,?,?,?) RETURNING *',args:[randomUUID(),p.name.trim(),p.category,p.quantity,Math.round(p.price*100),p.done?1:0]});
    res.status(201).json(mapRow(result.rows[0]));
  });
  app.patch('/api/products/:id',async(req,res)=>{
    if(typeof req.body?.done!=='boolean')return fail(res,400,'Estado no válido.');
    const r=await db.execute({sql:'UPDATE products SET done=?,version=version+1 WHERE id=? RETURNING *',args:[req.body.done?1:0,req.params.id]});
    if(!r.rows.length)return fail(res,404,'El producto ya no existe.');res.json(mapRow(r.rows[0]));
  });
  app.delete('/api/products/:id',async(req,res)=>{
    const version=Number(req.query.version);
    if(!Number.isInteger(version)||version<1)return fail(res,400,'Falta la versión del producto.');
    const r=await db.execute({sql:'DELETE FROM products WHERE id=? AND version=?',args:[req.params.id,version]});
    if(!r.rowsAffected)return fail(res,409,'El producto ha cambiado o ya no existe. Actualiza la lista antes de eliminarlo.');
    res.json({ok:true});
  });
  app.use('/api',(_req,res)=>fail(res,404,'Ruta no encontrada.'));
  app.use(express.static(path.join(root,'dist'),{index:false}));
  app.get('/{*path}',(_req,res)=>res.sendFile(path.join(root,'dist','index.html')));
  app.use((err,req,res,_next)=>{
    if(err instanceof SyntaxError&&'body' in err)return fail(res,400,'JSON no válido.');
    if(err.status===413)return fail(res,413,'Petición demasiado grande.');
    console.error('Error de petición:',req.method,req.path,err.code||err.name);
    fail(res,500,'No se pudo completar la operación. Inténtalo de nuevo.');
  });
  return {app,db};
}
