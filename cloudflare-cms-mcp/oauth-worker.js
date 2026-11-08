import { OAuthProvider, AuthorizationError } from '@cloudflare/workers-oauth-provider';
import { WorkerEntrypoint, env as bindings } from 'cloudflare:workers';
import cms from './worker.js';

const scopes=['cms:read','cms:draft','cms:publish'];
const secureHeaders={'cache-control':'no-store','content-security-policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",'x-content-type-options':'nosniff'};
const random=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const page=(body,status=200)=>new Response('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Faultline Brief OAuth</title><style>body{font:16px system-ui;max-width:620px;margin:8vh auto;padding:20px}button{padding:12px 20px}li{margin:10px 0}</style>'+body+'</html>',{status,headers:{...secureHeaders,'content-type':'text/html; charset=utf-8'}});
const key=(kind,id)=>'cms-oauth-'+kind+'-'+id;
const redirectError=(error)=>{
 if(!(error instanceof AuthorizationError))throw error;
 if(!error.redirectUri)return page('<h1>Authorization failed</h1><p>'+escape(error.description)+'</p>',400);
 const u=new URL(error.redirectUri);
 u.searchParams.set('error',error.code);u.searchParams.set('error_description',error.description);
 if(error.state)u.searchParams.set('state',error.state);
 if(error.issuer)u.searchParams.set('iss',error.issuer);
 return Response.redirect(u,302);
};
const app={
 async fetch(request,env){
  const url=new URL(request.url);
  if(!env.GITHUB_OAUTH_CLIENT_ID||!env.GITHUB_OAUTH_CLIENT_SECRET||!env.EDITOR_GITHUB_ID||!env.OAUTH_KV)return page('<h1>OAuth not configured</h1>',503);
  if(url.pathname==='/authorize'&&request.method==='GET'){
   let auth;try{auth=await env.OAUTH_PROVIDER.parseAuthRequest(request)}catch(e){return redirectError(e)}
   if(auth.scope.some(s=>!scopes.includes(s)))return page('Unsupported scope',400);
   const state=random();
   await env.OAUTH_KV.put(key('login',state),JSON.stringify({authUrl:request.url}),{expirationTtl:300});
   const github=new URL('https://github.com/login/oauth/authorize');
   github.searchParams.set('client_id',env.GITHUB_OAUTH_CLIENT_ID);
   github.searchParams.set('redirect_uri',url.origin+'/oauth/github/callback');
   github.searchParams.set('scope','read:user');
   github.searchParams.set('state',state);
   return Response.redirect(github,302);
  }
  if(url.pathname==='/oauth/github/callback'&&request.method==='GET'){
   const state=url.searchParams.get('state')||'',code=url.searchParams.get('code')||'';
   if(!/^[a-f0-9]{64}$/.test(state)||!code||code.length>512)return page('Invalid callback',400);
   const stored=await env.OAUTH_KV.get(key('login',state));
   if(!stored)return page('Expired or used login',400);
   await env.OAUTH_KV.delete(key('login',state));
   const record=JSON.parse(stored);
   const exchange=await fetch('https://github.com/login/oauth/access_token',{method:'POST',headers:{accept:'application/json','content-type':'application/json'},body:JSON.stringify({client_id:env.GITHUB_OAUTH_CLIENT_ID,client_secret:env.GITHUB_OAUTH_CLIENT_SECRET,code,redirect_uri:url.origin+'/oauth/github/callback'})});
   if(!exchange.ok)return page('GitHub authentication failed',502);
   const tokens=await exchange.json();
   if(!tokens.access_token)return page('GitHub authentication failed',401);
   const identity=await fetch('https://api.github.com/user',{headers:{authorization:'Bearer '+tokens.access_token,accept:'application/vnd.github+json','user-agent':'faultlinebrief-cms-oauth'}});
   if(!identity.ok)return page('GitHub identity check failed',401);
   const user=await identity.json();
   if(String(user.id)!==String(env.EDITOR_GITHUB_ID))return page('This GitHub account is not authorized for this CMS',403);
   const authRequest=await env.OAUTH_PROVIDER.parseAuthRequest(new Request(record.authUrl));
   const client=await env.OAUTH_PROVIDER.lookupClient(authRequest.clientId);
   if(!client)return page('Unrecognized OAuth client',400);
   const nonce=random();
   await env.OAUTH_KV.put(key('consent',nonce),JSON.stringify({authUrl:record.authUrl,githubId:String(user.id)}),{expirationTtl:300});
   const list=authRequest.scope.map(s=>'<li>'+escape(s)+'</li>').join('');
   return page('<h1>Authorize Faultline Brief CMS</h1><p>Signed in as '+escape(user.login)+'. Grant access to client <strong>'+escape(client.clientName||authRequest.clientId)+'</strong>?</p><p>Requested permissions:</p><ul>'+list+'</ul><p>Publishing still requires a separate one-time editorial approval.</p><form method="post" action="/oauth/consent"><input type="hidden" name="nonce" value="'+nonce+'"><button name="decision" value="approve">Allow</button> <button name="decision" value="deny">Deny</button></form>');
  }
  if(url.pathname==='/oauth/consent'&&request.method==='POST'){
   if(request.headers.get('origin')!==url.origin)return page('Invalid origin',403);
   const form=await request.formData(),nonce=form.get('nonce'),decision=form.get('decision');
   if(typeof nonce!=='string'||!/^[a-f0-9]{64}$/.test(nonce))return page('Invalid consent',400);
   const stored=await env.OAUTH_KV.get(key('consent',nonce));
   if(!stored)return page('Consent expired or used',400);
   await env.OAUTH_KV.delete(key('consent',nonce));
   const record=JSON.parse(stored);
   const authRequest=await env.OAUTH_PROVIDER.parseAuthRequest(new Request(record.authUrl));
   if(decision!=='approve'){
    const client=await env.OAUTH_PROVIDER.lookupClient(authRequest.clientId);
    if(!client)return page('Unknown client',400);
    const redirect=new URL(authRequest.redirectUri);
    redirect.searchParams.set('error','access_denied');
    if(authRequest.state)redirect.searchParams.set('state',authRequest.state);
    return Response.redirect(redirect,302);
   }
   if(String(record.githubId)!==String(env.EDITOR_GITHUB_ID))return page('Identity mismatch',403);
   const {redirectTo}=await env.OAUTH_PROVIDER.completeAuthorization({request:authRequest,userId:'github:'+record.githubId,metadata:{identityProvider:'github'},scope:authRequest.scope.filter(s=>scopes.includes(s)),props:{githubId:record.githubId}});
   return Response.redirect(redirectTo,302);
  }
  return new Response('Not found',{status:404});
 }
};
class CmsHandler extends WorkerEntrypoint {
 fetch(request){return cms.fetch(request,this.env,{oauth:this.ctx.auth,props:this.ctx.props})}
}
export default new OAuthProvider({
 apiRoute:'/mcp',
 apiHandler:CmsHandler,
 defaultHandler:app,
 authorizeEndpoint:'/authorize',
 tokenEndpoint:'/oauth/token',
 clientRegistrationEndpoint:'/oauth/register',
 scopesSupported:scopes,
 requiredScopes:['cms:read'],
 resourceMetadata:{resource:bindings.MCP_RESOURCE_URL,authorization_servers:[bindings.OAUTH_ISSUER],resource_name:'Faultline Brief CMS'},
 clientIdMetadataDocumentEnabled:true
});
