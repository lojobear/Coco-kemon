import {chromium} from 'playwright';import assert from 'node:assert/strict';import {mkdir} from 'node:fs/promises';
const output=process.env.BOOP_AUDIT_OUTPUT||'/tmp/boop-arena-ui';await mkdir(output,{recursive:true});
const browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),headless:true,args:['--no-sandbox']});
const base=process.env.BOOP_BASE_URL||'http://127.0.0.1:3000';
const cards=[{key:'fox',name:'Fox',emoji:'🦊',category:'Animals',coins:100,form:'normal'},{key:'whale',name:'Whale',emoji:'🐋',category:'Animals',coins:300,form:'shiny'}];
const room='match:11111111-1111-4111-8111-111111111111';
try{
 const guest=await browser.newPage();await guest.goto(base,{waitUntil:'networkidle'});await guest.getByRole('button',{name:'🏆 Arena',exact:true}).click();await guest.getByRole('button',{name:'Sign in / Cloud saves',exact:true}).waitFor();await guest.close();
 for(const width of [412,1440]){
  const page=await browser.newPage({viewport:{width,height:900}});const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>{
   const user={id:'11111111-1111-4111-8111-111111111111',aud:'authenticated',role:'authenticated',email:'arena-test@example.invalid',app_metadata:{provider:'google'},user_metadata:{},created_at:'2026-11-01T00:00:00Z'};
   const encode=value=>btoa(JSON.stringify(value)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
   const access_token=`${encode({alg:'HS256',typ:'JWT'})}.${encode({sub:user.id,exp:4102444800,aud:'authenticated',role:'authenticated'})}.test-signature`;
   localStorage.setItem('sb-lrjszbguvqgdsqvvcoqe-auth-token',JSON.stringify({access_token,refresh_token:'test-only',expires_at:4102444800,expires_in:3600,token_type:'bearer',user}));
  });
  await page.route('https://lrjszbguvqgdsqvvcoqe.supabase.co/**',route=>route.fulfill({json:[]}));
  let queueCalls=0;let locked=false;let games=0;let fail=false;
  await page.route('**/api/arena/**',async route=>{
   const action=new URL(route.request().url()).pathname.split('/').pop();const body=route.request().postDataJSON()||{};
   if(action==='collection')return route.fulfill({json:{cards}});
   if(action==='cancel'){games++;locked=false;return route.fulfill({json:{ok:true}});}
   if(fail)return route.fulfill({status:503,json:{error:'Arena connection interrupted. Retry shortly.'}});
   const opponent={name:games?'Byte Badger':'Online rival',bot:games>0,locked:games>0};
   const current={phase:'picking',category:'Animals',room,cards,deadline:Date.now()+45000,locked,opponent};
   const finish={...current,phase:'finished',result:games?'loss':'win',reason:'Both picks are revealed.',picks:{you:cards.find(card=>card.key===(games?'fox':'whale')),opponent:{...cards[0],name:games?'Bot Panther':'Rival Turtle',coins:games?500:50}}};
   if(action==='queue')return route.fulfill({json:++queueCalls===1?{phase:'waiting',category:'Animals',botAt:Date.now()+12000,waiting:1}:current});
   if(action==='pick'){assert.equal(body.key,games?'fox':'whale');assert.equal(body.coins,undefined);locked=true;return route.fulfill({json:games?finish:{...current,locked:true}});}
   return route.fulfill({json:locked?finish:current});
  });
  await page.goto(base,{waitUntil:'networkidle'});await page.getByRole('button',{name:'🏆 Arena',exact:true}).click();await page.getByRole('button',{name:'Quick match',exact:true}).waitFor();
  await page.getByRole('button',{name:'Quick match',exact:true}).click();await page.getByRole('heading',{name:'Finding your rival…'}).waitFor();
  const arena=page.getByRole('region',{name:'Value Arena'});await arena.getByText('Online rival',{exact:false}).waitFor();assert.ok(!(await arena.innerText()).includes('Rival Turtle'));
  assert.ok(await page.getByRole('button',{name:'Lock pick',exact:true}).isDisabled());await page.getByRole('button',{name:/Whale.*300/}).click();await page.getByRole('button',{name:'Lock pick',exact:true}).click();await page.getByRole('heading',{name:'You win!',exact:true}).waitFor();assert.ok((await arena.innerText()).includes('Rival Turtle'));
  await page.getByRole('button',{name:'Play again',exact:true}).click();await page.getByRole('button',{name:'Quick match',exact:true}).click();await arena.getByText('Byte Badger',{exact:false}).waitFor();assert.match(await arena.innerText(),/BOT/);
  await page.getByRole('button',{name:/Fox.*100/}).click();await page.getByRole('button',{name:'Lock pick',exact:true}).click();await page.getByRole('heading',{name:'Your rival wins',exact:true}).waitFor();
  await page.screenshot({path:`${output}/arena-${width}.png`});
  await page.getByRole('button',{name:'Play again',exact:true}).click();fail=true;await page.getByRole('button',{name:'Quick match',exact:true}).click();await page.getByRole('alert').filter({hasText:'connection interrupted'}).waitFor();
  const size=await page.evaluate(()=>({w:document.documentElement.clientWidth,s:document.documentElement.scrollWidth}));assert.ok(size.s<=size.w+1);assert.deepEqual(errors,[]);
  console.log(`${width}px: guest sign-in, public lobby, hidden human picks, server reveal, bot label, replay and connection failure passed`);await page.close();
 }
}finally{await browser.close();}
