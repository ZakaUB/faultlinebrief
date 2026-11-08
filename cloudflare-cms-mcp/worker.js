// Remote MCP over Streamable HTTP. Separate Worker; no direct D1 or R2 binding.
const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json","cache-control":"no-store","x-content-type-options":"nosniff"}});
const encoder=new TextEncoder();
async function eq(a,b){const h=async v=>new Uint8Array(await crypto.subtle.digest("SHA-256",encoder.encode(v)));const x=await h(a),y=await h(b);let d=a.length^b.length;for(let i=0;i<x.length;i++)d|=x[i]^y[i];return d===0}
const tools=[
{name:"list_drafts",description:"List existing Faultline Brief CMS drafts (read only).",inputSchema:{type:"object",properties:{},additionalProperties:false}},
{name:"get_draft",description:"Read a draft by CMS ID.",inputSchema:{type:"object",properties:{id:{type:"string"}},required:["id"],additionalProperties:false}},
{name:"create_draft",description:"Create an unpublished editorial draft; does not publish.",inputSchema:{type:"object",properties:{title:{type:"string"},slug:{type:"string"},body:{type:"string"},deck:{type:"string"},seoTitle:{type:"string"},seoDescription:{type:"string"},sources:{type:"array",items:{type:"object"}}},required:["title","slug","body"],additionalProperties:false}},
{name:"publish_approved_draft",description:"Publish an existing draft only with a fresh explicit editorial approval token issued out-of-band. Disabled until the separate CMS publish endpoint is configured.",inputSchema:{type:"object",properties:{id:{type:"string"},approvalToken:{type:"string"},expectedSlug:{type:"string"}},required:["id","approvalToken","expectedSlug"],additionalProperties:false}}
];
const err=(id,code,message)=>reply({jsonrpc:"2.0",id,error:{code,message}});
const result=(id,value)=>reply({jsonrpc:"2.0",id,result:value});
export default {async fetch(request,env,context){
 if(request.method==="GET"&&new URL(request.url).pathname==="/.well-known/oauth-protected-resource"){
   if(!env.OAUTH_ISSUER||!env.MCP_RESOURCE_URL)return reply({error:"oauth-not-configured"},503);
   return reply({resource:env.MCP_RESOURCE_URL,authorization_servers:[env.OAUTH_ISSUER],scopes_supported:["cms:read","cms:draft","cms:publish"]});
 }
 if(request.method==="GET"&&new URL(request.url).pathname==="/health")return reply({ok:true,service:"faultlinebrief-cms-mcp",publishingConfigured:!!env.CMS_PUBLISH_API_URL});
 if(request.method!=="POST"||new URL(request.url).pathname!=="/mcp")return reply({error:"not-found"},404);
 if(!env.CMS_DRAFT_API_URL||!env.CMS_DRAFT_API_TOKEN)return reply({error:"cms-not-configured"},503);
 const auth=context?.oauth,identity=context?.props;
 if(!auth||!identity||!env.EDITOR_GITHUB_ID||String(identity.githubId)!==String(env.EDITOR_GITHUB_ID))return reply({error:"unauthorized"},401);
 const scopes=Array.isArray(auth.scope)?auth.scope:[];
 let q;try{q=await request.json()}catch{return err(null,-32700,"Invalid JSON")}
 const id=q.id??null;
 if(q.jsonrpc!=="2.0")return err(id,-32600,"Invalid JSON-RPC");
 if(q.method==="initialize")return result(id,{protocolVersion:"2025-03-26",capabilities:{tools:{}},serverInfo:{name:"faultlinebrief-cms",version:"0.1.0"}});
 if(q.method==="notifications/initialized")return new Response(null,{status:202});
 if(q.method==="ping")return result(id,{});
 if(q.method==="tools/list")return result(id,{tools});
 if(q.method!=="tools/call")return err(id,-32601,"Method not found");
 const name=q.params?.name,args=q.params?.arguments||{};
 if(!tools.some(t=>t.name===name))return err(id,-32602,"Unknown tool");
 const required=name==="publish_approved_draft"?"cms:publish":name==="create_draft"?"cms:draft":"cms:read";
 if(!scopes.includes(required))return result(id,{content:[{type:"text",text:"Missing OAuth scope: "+required}],isError:true});
 const validId=typeof args.id==="string"&&/^[a-zA-Z0-9_-]{1,120}$/.test(args.id);
 let endpoint,method="GET",body,token=env.CMS_DRAFT_API_TOKEN;
 const base=env.CMS_DRAFT_API_URL.replace(/\/$/,"");
 if(name==="list_drafts")endpoint=base+"/integration/v1/drafts";
 if(name==="get_draft"){if(!validId)return err(id,-32602,"Invalid draft ID");endpoint=base+"/integration/v1/drafts/"+encodeURIComponent(args.id)}
 if(name==="create_draft"){
  if(typeof args.title!=="string"||args.title.length<10||args.title.length>250||typeof args.slug!=="string"||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(args.slug)||args.slug.length>200||typeof args.body!=="string"||args.body.length<100||args.body.length>100000)return err(id,-32602,"Invalid draft fields");
  endpoint=base+"/integration/v1/drafts";method="POST";
  body=JSON.stringify({slug:args.slug,headline:args.title,article_text:args.body,deck:args.deck||"",seo_title:args.seoTitle||"",seo_description:args.seoDescription||"",sources:args.sources||[],status:"draft"});
 }
 if(name==="publish_approved_draft"){
  if(!validId||typeof args.expectedSlug!=="string"||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(args.expectedSlug)||typeof args.approvalToken!=="string"||args.approvalToken.length<32)return err(id,-32602,"Invalid approval details");
  if(!env.CMS_PUBLISH_API_URL||!env.CMS_PUBLISH_API_TOKEN)return result(id,{content:[{type:"text",text:"Publishing is disabled: the CMS-side approval endpoint is not configured."}],isError:true});
  endpoint=env.CMS_PUBLISH_API_URL.replace(/\/$/,"")+"/integration/v1/approved-publish";method="POST";token=env.CMS_PUBLISH_API_TOKEN;
  body=JSON.stringify({id:args.id,expectedSlug:args.expectedSlug,approvalToken:args.approvalToken});
 }
 try{
  const url=new URL(endpoint);
  if(url.protocol!=="https:")return err(id,-32603,"CMS endpoint must use HTTPS");
  const res=await fetch(url,{method,headers:{"authorization":"Bearer "+token,...(body?{"content-type":"application/json"}:{})},body,redirect:"error",signal:AbortSignal.timeout(12000)});
  const text=await res.text();let value;try{value=JSON.parse(text)}catch{value={error:"Unexpected CMS response"}}
  return result(id,{content:[{type:"text",text:JSON.stringify(value)}],isError:!res.ok});
 }catch{return result(id,{content:[{type:"text",text:"CMS unavailable or request timed out"}],isError:true})}
}};
