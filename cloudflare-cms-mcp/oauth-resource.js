import { OAuthResourceServer, insufficientScope } from "@cloudflare/workers-oauth-provider";
import cms from "./worker.js";
const resource="https://faultlinebrief-cms-mcp.example.workers.dev/mcp";
export default new OAuthResourceServer({
 resourceMetadata:{resource,authorization_servers:["https://faultlinebrief-cms-auth.example.workers.dev"]},
 requiredScopes:["cms:read"],
 validateToken:env=>env.AUTH_SERVER.validateToken,
 handler:{
  async fetch(request,env,ctx){
   if(!env.EDITOR_GITHUB_ID||String(ctx.props?.githubId)!==String(env.EDITOR_GITHUB_ID))return new Response("Forbidden",{status:403});
   // The MCP tool dispatcher additionally checks cms:draft/cms:publish.
   const body=await request.clone().text();
   if(body.length>200000)return new Response("Request too large",{status:413});
   let call;try{call=JSON.parse(body)}catch{return new Response("Invalid JSON",{status:400})}
   const name=call?.method==="tools/call"?call.params?.name:null;
   const needed=name==="publish_approved_draft"?"cms:publish":name==="create_draft"?"cms:draft":"cms:read";
   if(!ctx.auth.scope.includes(needed))return insufficientScope(ctx.auth,["cms:read",needed]);
   return cms.fetch(request,env,{oauth:ctx.auth,props:ctx.props});
  }
 }
});
