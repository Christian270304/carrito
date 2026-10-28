import {StrictMode,useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {ShoppingBasket,LogOut} from 'lucide-react';
import ShoppingList from './ShoppingList';
import {api} from './api';
import './style.css';
function App(){
 const[user,setUser]=useState<string|null>(null),[ready,setReady]=useState(false),[username,setUsername]=useState(''),[password,setPassword]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{api('/api/me').then(async r=>{if(r.ok)setUser((await r.json()).username);else if(r.status!==401)setError('No se pudo contactar con el servidor.')}).catch(()=>setError('No se pudo contactar con el servidor.')).finally(()=>setReady(true));const expire=()=>setUser(null);window.addEventListener('session-expired',expire);return()=>window.removeEventListener('session-expired',expire)},[]);
 async function login(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');try{const r=await api('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password})});const data=await r.json();if(!r.ok)throw Error(data.error||'No se pudo iniciar sesión.');setUser(data.username);setPassword('')}catch(e){setError(e instanceof Error?e.message:'No se pudo conectar.')}finally{setBusy(false)}}
 async function logout(){try{const r=await api('/api/logout',{method:'POST'});if(!r.ok)throw Error();setUser(null)}catch{alert('No se pudo cerrar sesión. Vuelve a intentarlo.')}}
 if(!ready)return <div className="login-page">Abriendo tu casa…</div>;
 if(user)return <><ShoppingList/><button className="logout" onClick={logout} title={'Cerrar sesión de '+user}><LogOut size={14}/><span>{user} · Salir</span></button></>;
 return <div className="login-page"><section className="login-card"><div className="login-logo"><ShoppingBasket size={27}/></div><p className="eyebrow">UN HOGAR, UNA LISTA</p><h1>Bienvenido a casa<span>.</span></h1><p>Entra para organizar la compra entre todos.</p><form onSubmit={login}><label>Usuario<input required autoComplete="username" maxLength={32} value={username} onChange={e=>setUsername(e.target.value)} placeholder="Tu usuario"/></label><label>Contraseña<input required type="password" autoComplete="current-password" maxLength={200} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Tu contraseña"/></label>{error&&<p className="error" role="alert">{error}</p>}<button className="primary" disabled={busy}>{busy?'Entrando…':'Entrar en casa'}</button></form><small>El administrador de la casa configura los usuarios.</small></section></div>
}
createRoot(document.getElementById('root')!).render(<StrictMode><App/></StrictMode>);
