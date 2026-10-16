// Read-only authenticated staging checks. Never run against production.
// Credentials are supplied by GitHub Actions encrypted staging environment.
const origin = 'https://faultlinebrief-cf-staging.zakria25.workers.dev';
const password = process.env.STAGING_ACCESS_PASSWORD;
if (!password || password.length < 24) throw Error('Missing staging-only access password');
const authorization = 'Basic ' + Buffer.from('staging:' + password).toString('base64');
const cases = [
  {name:'homepage',path:'/',type:'text/html',contains:'Faultline Brief'},
  {name:'about',path:'/about',type:'text/html',contains:'About Faultline Brief'},
  {name:'latest news',path:'/latest-news',type:'text/html',contains:'LATEST'},
  {name:'published Space Force story',path:'/articles/spacex-classified-us-space-force-ussf-481-launch-october-2026',type:'text/html',contains:'SpaceX'},
  {name:'Greenland analysis',path:'/articles/why-greenland-matters-us-europe-nato-arctic-minerals-security',type:'text/html',contains:'Greenland'},
  {name:'main sitemap',path:'/sitemap.xml',type:'xml',contains:'<url'},
  {name:'news sitemap',path:'/news-sitemap.xml',type:'xml',contains:'<url'},
  {name:'Payload admin login',path:'/admin/login',type:'text/html',contains:'login'},
];
let failed = 0;
for (const item of cases) {
  const start = performance.now();
  try {
    const res = await fetch(origin+item.path,{headers:{Authorization:authorization},signal:AbortSignal.timeout(20000),redirect:'manual'});
    const body = await res.text();
    const type = res.headers.get('content-type')||'';
    const robots = res.headers.get('x-robots-tag')||'';
    const ok = res.status===200 && type.includes(item.type) && body.toLowerCase().includes(item.contains.toLowerCase()) && robots.includes('noindex');
    console.log(JSON.stringify({test:item.name,pass:ok,status:res.status,contentType:type.split(';')[0],hasNoindex:robots.includes('noindex'),durationMs:Math.round(performance.now()-start)}));
    if(!ok) failed++;
  }catch(e){failed++;console.log(JSON.stringify({test:item.name,pass:false,error:e instanceof Error?e.name:'unknown'}));}
}
const protectedPath='/';
const noauth = await fetch(origin+protectedPath,{redirect:'manual',signal:AbortSignal.timeout(10000)});
const denied = noauth.status === 401 && (noauth.headers.get('x-robots-tag')||'').includes('noindex');
console.log(JSON.stringify({test:'access gate',pass:denied,status:noauth.status}));if(!denied)failed++;
const robotsResponse = await fetch(origin+'/robots.txt',{signal:AbortSignal.timeout(10000)});
const robotsText = await robotsResponse.text();
const robotsPass = robotsResponse.status===200 && robotsText.includes('Disallow: /');
console.log(JSON.stringify({test:'robots disallow',pass:robotsPass,status:robotsResponse.status}));if(!robotsPass)failed++;
console.log('Authenticated staging checks passed:',cases.length+2-failed,'/',cases.length+2);
if(failed)process.exitCode=1;
