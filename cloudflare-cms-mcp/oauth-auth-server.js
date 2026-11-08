import { WorkerEntrypoint } from "cloudflare:workers";
import { OAuthAuthorizationServer, AuthorizationError, authorizationErrorRedirect } from "@cloudflare/workers-oauth-provider";

const ISSUER="https://faultlinebrief-cms-auth.example.workers.dev";
const RESOURCE="https://faultlinebrief-cms-mcp.example.workers.dev/mcp";
const server=new OAuthAuthorizationServer({
 issuer:ISSUER,resources:[RESOURCE],
 scopesSupported:["cms:read","cms:draft","cms:publish","offline_access"],
 clientIdMetadataDocumentEnabled:true
});
const htmlEscape=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const b64url=bytes=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
async function challenge(verifier){return b64url(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(verifier))))}
const page=(client,request,handle)=>`<!doctype html><html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Faultline Brief authorization</title><body style="font:16px system-ui;max-width:600px;margin:5vh auto"><h1>Authorize Faultline Brief CMS</h1><p>Client: <strong>${htmlEscape(client.clientName||request.clientId)}</strong></p><p>Requested permissions: ${htmlEscape(request.scope.join(", "))}</p><p>Only authorize clients you trust. Publishing still requires a separate editorial approval token.</p><form method="POST" action="/authorize"><input type="hidden" name="handle" value="${htmlEscape(handle)}"><button name="decision" value="allow">Continue with GitHub</button> <button name="decision" value="deny">Deny</button></form></body></html>`;
const errorResponse=(error)=>error instanceof AuthorizationError&&error.redirectTo?Response.redirect(error.redirectTo,302):new Response("Invalid OAuth authorization request",{status:400});
async function authorize(request,env){
 const oauth=server.getOAuthApi(env);
 if(request.method==="GET"){
  let auth;try{auth=await oauth.parseAuthRequest(request)}catch(e){return errorResponse(e)}
  const client=await oauth.lookupClient(auth.clientId);
  if(!client)return new Response("Unknown OAuth client",{status:400});
  const consent=await oauth.beginConsent(auth);
  return new Response(page(client,auth,consent.handle),{headers:{...Object.fromEntries(consent.headers),"content-type":"text/html; charset=utf-8","cache-control":"no-store","content-security-policy":"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'"}});
 }
 if(request.method!=="POST")return new Response("Method not allowed",{status:405});
 const form=await request.formData(),handle=form.get("handle");
 if(typeof handle!=="string")return new Response("Invalid consent",{status:400});
 if(form.get("decision")==="deny"){
  try{const denied=await oauth.denyConsent(request,handle);return Response.redirect(denied.redirectTo,302)}catch{return new Response("Consent expired",{status:400})}
 }
 if(form.get("decision")!=="allow")return new Response("Invalid consent",{status:400});
 let approved;try{approved=await oauth.approveConsent(request,handle)}catch{return new Response("Consent expired",{status:400})}
 const verifier=b64url(crypto.getRandomValues(new Uint8Array(32)));
 const upstream=await oauth.beginUpstream(approved.request,{data:{verifier},headers:approved.headers});
 const github=new URL("https://github.com/login/oauth/authorize");
 github.searchParams.set("client_id",env.GITHUB_OAUTH_CLIENT_ID);
 github.searchParams.set("redirect_uri",ISSUER+"/callback");
 github.searchParams.set("state",upstream.state);
 github.searchParams.set("code_challenge",await challenge(verifier));
 github.searchParams.set("code_challenge_method","S256");
 github.searchParams.set("scope","read:user");
 upstream.headers.set("Location",github.toString());
 return new Response(null,{status:302,headers:upstream.headers});
}
async function callback(request,env){
 const oauth=server.getOAuthApi(env);
 let session;try{session=await oauth.finishUpstream(request)}catch{return new Response("Invalid or expired login session",{status:400})}
 const {request:original,data,headers}=session;
 const query=new URL(request.url).searchParams;
 if(query.has("error")){headers.set("Location",authorizationErrorRedirect(original,"access_denied"));return new Response(null,{status:302,headers})}
 const code=query.get("code");
 if(!code)return new Response("Missing GitHub code",{status:400});
 const response=await fetch("https://github.com/login/oauth/access_token",{method:"POST",headers:{"accept":"application/json","content-type":"application/json"},body:JSON.stringify({client_id:env.GITHUB_OAUTH_CLIENT_ID,client_secret:env.GITHUB_OAUTH_CLIENT_SECRET,code,redirect_uri:ISSUER+"/callback",code_verifier:data.verifier}),redirect:"error"});
 if(!response.ok)return new Response("GitHub sign-in failed",{status:502});
 const tokenData=await response.json();
 if(!tokenData.access_token)return new Response("GitHub authorization rejected",{status:401});
 const userRes=await fetch("https://api.github.com/user",{headers:{"authorization":"Bearer "+tokenData.access_token,"accept":"application/vnd.github+json","user-agent":"faultlinebrief-cms-auth"},redirect:"error"});
 if(!userRes.ok)return new Response("GitHub identity unavailable",{status:502});
 const user=await userRes.json();
 if(!Number.isSafeInteger(user.id)||String(user.id)!==String(env.EDITOR_GITHUB_ID))return new Response("GitHub account not authorized for Faultline Brief",{status:403});
 const granted=original.scope.filter(s=>["cms:read","cms:draft","cms:publish","offline_access"].includes(s));
 const completed=await oauth.completeAuthorization({request:original,userId:String(user.id),metadata:{provider:"github"},scope:granted,props:{githubId:String(user.id)}});
 headers.set("Location",completed.redirectTo);
 return new Response(null,{status:302,headers});
}
export default class AuthServer extends WorkerEntrypoint {
 async fetch(request){
  if(!this.env.GITHUB_OAUTH_CLIENT_ID||!this.env.GITHUB_OAUTH_CLIENT_SECRET||!this.env.EDITOR_GITHUB_ID)return new Response("Authentication not configured",{status:503});
  const path=new URL(request.url).pathname;
  if(path==="/authorize")return authorize(request,this.env);
  if(path==="/callback")return callback(request,this.env);
  return server.fetch(request,this.env,this.ctx);
 }
 validateToken(resource,token){return server.validateToken(resource,token,this.env)}
}
