/**
 * Boop's ORIGINAL, offline pixel-art icon collection.
 * 24x24 hand-drawn silhouettes, recolored and accented deterministically for
 * each discovery. No emoji, no network, no AI quota, no canvas dependency.
 *
 * Uploaded artwork and completed AI sprites always take priority in the UI.
 */
const INK='#27313f';
type Form='fire'|'water'|'wind'|'earth'|'tree'|'flower'|'mushroom'|'fish'|'cat'|'dog'
  |'cake'|'pizza'|'coffee'|'robot'|'rocket'|'cloud'|'sun'|'moon'|'star'|'gem'
  |'book'|'sword'|'heart'|'house'|'mountain'|'burger'|'snow'|'bird'|'butterfly'
  |'clock'|'bottle'|'egg'|'leaf'|'ghost'|'battery'|'planet'|'shell'|'key'
  |'curio'|'relic'|'creature'|'mechanism'|'crystal'|'toaster'|'dragon'|'skull'|'crown'
  |'train'|'car'|'noodles'|'lantern'|'compass'|'camera'|'trophy'|'gift'|'music'
  |'sushi'|'taco'|'icecream'|'cheese'|'berry'|'apple'|'phone'|'helicopter'
  |'dinosaur'|'cactus'|'castle'|'pancakes'|'umbrella'|'fox'|'bread'
  |'delight'|'cereal'|'cookie'|'donut'|'steak'|'pie'|'candle'|'sandwich'|'dumpling'|'soda';
type Palette={base:string;light:string;shade:string;accent:string;bright:string};
const PALETTES:Record<string,Palette>={
 fire:{base:'#f87040',light:'#ffb76b',shade:'#b83f3a',accent:'#f7d36d',bright:'#fff4a4'},
 water:{base:'#47b5e5',light:'#9de8fc',shade:'#2775b2',accent:'#e6faff',bright:'#ffffff'},
 earth:{base:'#b18c60',light:'#dbc094',shade:'#725b51',accent:'#76b67b',bright:'#e5d8b7'},
 nature:{base:'#68b97c',light:'#b0e69b',shade:'#327854',accent:'#facb75',bright:'#e7f8b6'},
 food:{base:'#f6b95f',light:'#ffdc9c',shade:'#bc764e',accent:'#e57783',bright:'#fff6c7'},
 magic:{base:'#9a8be1',light:'#dfc4ff',shade:'#5f5ca7',accent:'#fae38d',bright:'#f5f0ff'},
 tech:{base:'#899cb7',light:'#dbe4f0',shade:'#526883',accent:'#6ed3e0',bright:'#ffffff'},
 ice:{base:'#8ee1ec',light:'#e6fbff',shade:'#55b7ce',accent:'#b0a7eb',bright:'#ffffff'},
 cosmic:{base:'#9c8adb',light:'#e5cfff',shade:'#53589a',accent:'#ffc974',bright:'#fff6ba'},
 animal:{base:'#dfaa83',light:'#f9d9a7',shade:'#a77870',accent:'#e98086',bright:'#fff1c9'}
};
const PATTERNS:Array<[RegExp,Form,keyof typeof PALETTES]>=[
  // Named, individually drawn food sprites—not a generic cake/burger icon for all dishes.
  [/\b(?:turkish delight|lokum|rosewater candy)\b/i,'delight','food'],
  [/\b(?:cereal|granola|porridge|oatmeal|cornflakes)\b/i,'cereal','food'],
  [/\b(?:cookie|biscuit|shortbread)\b/i,'cookie','food'],
  [/\b(?:donut|doughnut|cruller)\b/i,'donut','food'],
  [/\b(?:steak|ribeye|sirloin|tenderloin)\b/i,'steak','food'],
  [/\b(?:fruit pie|apple pie|cherry pie|pumpkin pie)\b/i,'pie','food'],
  [/\b(?:candle|wax|wick)\b/i,'candle','magic'],
  [/\b(?:sandwich|panini|submarine sandwich|grilled cheese)\b/i,'sandwich','food'],
  [/\b(?:dumpling|gyoza|pierogi|wonton|bao)\b/i,'dumpling','food'],
  [/\b(?:soda|fizzy drink|lemonade|cola|pop)\b/i,'soda','food'],
 [ /\b(?:sushi|nigiri|onigiri|maki)\b/i, 'sushi', 'food' ],
 [ /\b(?:taco|burrito|quesadilla)\b/i, 'taco', 'food' ],
 [ /\b(?:ice cream|gelato|sorbet|sundae|popsicle)\b/i, 'icecream', 'food' ],
 [ /\b(?:cheese|cheddar|mozzarella)\b/i, 'cheese', 'food' ],
 [ /\b(?:strawberry|blueberry|raspberry|berry)\b/i, 'berry', 'nature' ],
 [ /\b(?:apple|pear|orchard)\b/i, 'apple', 'nature' ],
 [ /\b(?:smartphone|phone|tablet|pixel phone)\b/i, 'phone', 'tech' ],
 [ /\b(?:helicopter|propeller|chopper)\b/i, 'helicopter', 'tech' ],
 [ /\b(?:dinosaur|raptor|t[- ]?rex)\b/i, 'dinosaur', 'animal' ],
 [ /\b(?:cactus|succulent|desert plant)\b/i, 'cactus', 'nature' ],
 [ /\b(?:castle|fortress|palace)\b/i, 'castle', 'earth' ],
 [ /\b(?:pancakes?|crepes?)\b/i, 'pancakes', 'food' ],
 [ /\b(?:umbrella|parasol)\b/i, 'umbrella', 'ice' ],
 [ /\b(?:fox|kitsune)\b/i, 'fox', 'animal' ],
 [ /\b(?:bread|loaf|baguette|croissant|toast)\b/i, 'bread', 'food' ],
 [/\b(?:fire|flame|lava|ember|inferno|volcano)\b/i,'fire','fire'],
 [/\b(?:water|ocean|river|sea|lake|rain|tidal)\b/i,'water','water'],
 [/\b(?:wind|breeze|tornado|air|gust)\b/i,'wind','ice'],
 [/\b(?:earth|stone|soil|mud|sand|rock)\b/i,'earth','earth'],
 [/\b(?:tree|forest|oak|pine|wood)\b/i,'tree','nature'],
 [/\b(?:flower|rose|sunflower|tulip|blossom)\b/i,'flower','nature'],
 [/\b(?:mushroom|fungus|toadstool)\b/i,'mushroom','food'],
 [/\b(?:fish|shark|whale|dolphin|salmon)\b/i,'fish','water'],
 [/\b(?:cat|kitten|tiger|lion)\b/i,'cat','animal'],
 [/\b(?:dog|wolf|puppy|fox)\b/i,'dog','animal'],
 [/\b(?:cake|cupcake|muffin|pie|donut|ice cream|dessert)\b/i,'cake','food'],
 [/\b(?:pizza)\b/i,'pizza','food'],
 [/\b(?:coffee|tea|espresso|latte)\b/i,'coffee','food'],
 [/\b(?:robot|android|cyborg|automaton)\b/i,'robot','tech'],
 [/\b(?:rocket|spaceship|satellite|spacecraft)\b/i,'rocket','cosmic'],
 [/\b(?:cloud|steam|smoke|fog|mist)\b/i,'cloud','ice'],
 [/\b(?:sun|sunshine|solar)\b/i,'sun','food'],
 [/\b(?:moon|lunar|crescent)\b/i,'moon','cosmic'],
 [/\b(?:star|comet|meteor|starlight)\b/i,'star','cosmic'],
 [/\b(?:gem|crystal|diamond|ruby|emerald|jewel|pearl)\b/i,'gem','magic'],
 [/\b(?:book|library|novel|storybook)\b/i,'book','earth'],
 [/\b(?:sword|blade|knife|dagger)\b/i,'sword','tech'],
 [/\b(?:heart|love|romance)\b/i,'heart','food'],
 [/\b(?:house|home|cottage|hut|castle)\b/i,'house','earth'],
 [/\b(?:mountain|cliff|peak|hill)\b/i,'mountain','earth'],
 [/\b(?:burger|sandwich|bread|toast|breakfast|bagel)\b/i,'burger','food'],
 [/\b(?:snow|blizzard|ice|frost|winter)\b/i,'snow','ice'],
 [/\b(?:bird|eagle|owl|parrot|chicken)\b/i,'bird','animal'],
 [/\b(?:butterfly|moth|dragonfly|bee|insect)\b/i,'butterfly','nature'],
 [/\b(?:clock|time|watch|hourglass)\b/i,'clock','tech'],
 [/\b(?:bottle|potion|elixir|perfume|infusion)\b/i,'bottle','magic'],
 [/\b(?:egg|nest)\b/i,'egg','food'],
 [/\b(?:leaf|grass|herb|basil)\b/i,'leaf','nature'],
 [/\b(?:ghost|spirit|phantom)\b/i,'ghost','magic'],
 [/\b(?:battery|electric|electricity|machine|computer|internet)\b/i,'battery','tech'],
 [/\b(?:planet|galaxy|universe|saturn)\b/i,'planet','cosmic'],
 [/\b(?:shell|coral|seashell)\b/i,'shell','water'],
 [/\b(?:key|lock|door)\b/i,'key','tech'],
 [/\b(?:toaster|oven|microwave|strudel|waffle)\b/i,'toaster','food'],
 [/\b(?:dragon|wyrm|wyvern|griffin|phoenix)\b/i,'dragon','magic'],
 [/\b(?:skull|skeleton|bones|fossil)\b/i,'skull','earth'],
 [/\b(?:crown|royalty|king|queen|tiara)\b/i,'crown','magic'],
 [/\b(?:train|locomotive|railway)\b/i,'train','tech'],
 [/\b(?:car|truck|vehicle|automobile)\b/i,'car','tech'],
 [/\b(?:noodle|ramen|pasta|spaghetti|soup)\b/i,'noodles','food'],
 [/\b(?:lantern|lamp|lightbulb|beacon)\b/i,'lantern','magic'],
 [/\b(?:compass|map|navigation|explorer)\b/i,'compass','earth'],
 [/\b(?:camera|photo|photography|film)\b/i,'camera','tech'],
 [/\b(?:trophy|medal|champion|award)\b/i,'trophy','food'],
 [/\b(?:present|gift|package|parcel)\b/i,'gift','magic'],
 [/\b(?:music|guitar|piano|song|melody|drum)\b/i,'music','magic'],
];
function hash(name:string):number{
  let n=2166136261;
  for(const c of name.toLowerCase()) n=Math.imul(n^c.charCodeAt(0),16777619);
  return n>>>0;
}
function pickForm(name:string):[Form,Palette]{
  for(const [pattern,form,palette] of PATTERNS)if(pattern.test(name))return [form,PALETTES[palette]];
  const n=hash(name);
  const generic:Form[]=['curio','relic','creature','mechanism','crystal',
    'lantern','compass','camera','trophy','gift','music','crown','toaster','skull','dragon'];
  return [generic[n%generic.length],Object.values(PALETTES)[(n>>>5)%Object.keys(PALETTES).length]];
}
const CACHE=new Map<string,string>();
export function pixelArtFormFor(name:string):string {return pickForm(name)[0];}
export function generateFreshPixelArt(name:string):string {
  const key=name.trim().toLowerCase();
  if(!key)return '';
  const cached=CACHE.get(key);if(cached)return cached;
  const seed=hash(key),[form,p]=pickForm(key);
  const w=24,h=24;
  const pixels:Array<string|null>=Array(w*h).fill(null);
  const dot=(x:number,y:number,color:string)=>{x=Math.round(x);y=Math.round(y);if(x>=2&&x<22&&y>=2&&y<22)pixels[y*w+x]=color;};
  const rect=(x:number,y:number,ww:number,hh:number,c:string)=>{for(let j=y;j<y+hh;j++)for(let i=x;i<x+ww;i++)dot(i,j,c);};
  const ellipse=(x:number,y:number,rx:number,ry:number,c:string)=>{
    for(let j=Math.floor(y-ry);j<=y+ry;j++)for(let i=Math.floor(x-rx);i<=x+rx;i++)
      if((i-x)**2/(rx**2)+(j-y)**2/(ry**2)<=1)dot(i,j,c);
  };
  const line=(x1:number,y1:number,x2:number,y2:number,c:string,t=1)=>{
    const steps=Math.max(Math.abs(x2-x1),Math.abs(y2-y1),1);
    for(let i=0;i<=steps;i++) {const x=x1+(x2-x1)*i/steps,y=y1+(y2-y1)*i/steps;rect(Math.round(x),Math.round(y),t,t,c);}
  };
  const B=p.base,L=p.light,S=p.shade,A=p.accent,H=p.bright;
  const star=(x:number,y:number,size:number,c:string)=>{line(x-size,y,x+size,y,c);line(x,y-size,x,y+size,c);dot(x,y,H);};
  switch(form){
    case 'fire':
      ellipse(12,15,6,6,B);line(7,15,10,6,B,4);line(11,15,14,4,S,3);line(16,16,18,9,B,3);ellipse(12,16,3,4,A);line(12,18,12,12,H,2);break;
    case 'water':
      ellipse(12,15,7,6,B);line(6,13,12,4,B,5);line(12,4,18,13,S,4);ellipse(9,15,3,4,L);rect(9,14,2,3,H);break;
    case 'wind':
      line(3,10,17,10,B,2);line(17,10,19,7,L,2);line(4,14,20,14,S,2);line(14,18,7,18,L,2);star(17,5,1,A);break;
    case 'earth':
      ellipse(12,15,8,7,S);rect(6,12,12,7,B);rect(7,10,5,3,L);rect(15,14,3,2,A);star(9,8,1,A);break;
    case 'tree':
      rect(10,12,4,9,S);ellipse(12,10,8,7,B);ellipse(9,8,5,5,L);ellipse(15,12,5,4,B);rect(11,16,2,3,L);break;
    case 'flower':
      rect(11,11,2,10,S);ellipse(8,16,4,2,B);ellipse(16,15,4,2,B);for(const [x,y] of [[12,5],[7,9],[17,9],[8,14],[16,14]])ellipse(x,y,3,3,A);ellipse(12,10,3,3,L);rect(11,9,2,2,H);break;
    case 'mushroom':
      rect(10,11,5,9,L);ellipse(12,10,9,6,S);ellipse(12,8,8,5,B);rect(7,7,3,2,H);rect(15,9,3,2,H);rect(9,17,7,2,S);break;
    case 'fish':
      ellipse(11,12,7,6,B);line(17,11,21,6,S,2);line(17,13,21,18,S,2);ellipse(9,9,3,2,L);dot(8,11,INK);rect(5,14,4,1,H);break;
    case 'cat':case 'dog':
      ellipse(12,13,7,6,B);ellipse(6,8,3,5,S);ellipse(18,8,3,5,S);ellipse(12,14,5,4,L);
      rect(8,12,2,2,INK);rect(15,12,2,2,INK);rect(11,15,3,2,A);line(9,18,12,19,S);line(15,18,12,19,S);break;
    case 'cake':
      rect(5,11,14,9,B);rect(5,10,14,3,L);rect(5,16,14,2,A);rect(11,5,2,5,S);rect(11,3,2,3,H);rect(8,12,2,2,H);rect(15,12,2,2,H);break;
    case 'pizza':
      line(5,6,18,8,B,3);line(5,6,12,20,B,4);line(18,8,12,20,B,4);ellipse(10,11,2,2,A);ellipse(15,13,2,2,A);rect(11,16,2,2,L);break;
    case 'coffee':
      rect(5,10,12,10,L);rect(5,14,12,6,B);rect(17,12,4,5,S);rect(18,13,2,2,H);line(7,6,7,3,A);line(12,7,12,4,A);line(15,6,15,3,A);break;
    case 'robot':
      rect(5,7,14,13,S);rect(6,9,12,9,B);rect(8,11,3,3,A);rect(14,11,3,3,A);rect(10,16,5,2,INK);line(12,7,12,3,L);star(12,3,1,A);break;
    case 'rocket':
      ellipse(12,12,5,9,B);ellipse(10,9,2,3,L);rect(10,14,4,5,S);line(8,15,4,20,A,2);line(16,15,20,20,A,2);line(11,19,11,22,H,2);break;
    case 'cloud':
      ellipse(7,13,5,4,B);ellipse(13,10,6,6,L);ellipse(18,14,4,4,B);rect(6,13,14,5,L);rect(8,12,4,2,H);break;
    case 'sun':
      ellipse(12,12,6,6,A);ellipse(10,9,3,3,H);for(let i=0;i<8;i++){const rad=i*Math.PI/4;const x=12+Math.cos(rad)*10,y=12+Math.sin(rad)*10;dot(x,y,B);dot(x+Math.cos(rad),y+Math.sin(rad),L)}break;
    case 'moon':
      ellipse(12,12,8,8,B);ellipse(16,9,7,7,S);ellipse(8,11,2,2,L);ellipse(12,17,2,2,A);break;
    case 'star':star(12,12,7,A);ellipse(12,12,4,4,B);star(12,12,3,L);break;
    case 'gem':
      line(6,8,18,8,L,3);line(6,9,12,20,B,4);line(18,9,12,20,S,4);rect(10,7,4,3,H);line(12,10,12,17,A,2);break;
    case 'book':
      rect(4,6,8,14,B);rect(12,6,8,14,S);rect(6,8,5,9,L);rect(13,8,5,9,H);line(12,6,12,20,INK,1);rect(7,11,3,1,S);rect(14,12,3,1,B);break;
    case 'sword':
      line(16,3,8,16,L,3);line(16,3,12,13,H);line(6,14,13,20,S,2);line(5,17,11,12,A,2);rect(5,20,3,2,B);break;
    case 'heart':
      ellipse(8,9,5,4,A);ellipse(16,9,5,4,A);line(5,12,12,20,B,5);line(19,12,12,20,B,5);rect(7,7,4,2,H);break;
    case 'house':
      rect(5,11,14,9,B);line(4,12,12,4,S,4);line(12,4,20,12,S,4);rect(10,14,4,6,A);rect(6,13,3,3,H);break;
    case 'mountain':
      line(3,19,12,5,S,5);line(12,5,21,19,B,5);line(9,10,12,6,H,3);line(12,6,16,12,H,3);rect(5,19,15,2,A);break;
    case 'burger':
      ellipse(12,9,9,5,B);rect(3,11,18,2,A);rect(4,14,16,3,S);rect(4,17,16,3,B);rect(7,6,2,1,H);rect(13,7,2,1,H);break;
    case 'snow':
      line(12,3,12,21,B,2);line(3,12,21,12,B,2);line(6,6,18,18,B,2);line(6,18,18,6,B,2);ellipse(12,12,3,3,H);break;
    case 'bird':
      ellipse(12,14,7,5,B);ellipse(15,10,5,5,L);line(5,15,3,10,S,3);rect(18,10,4,2,A);dot(16,9,INK);line(10,19,9,22,S);line(15,19,16,22,S);break;
    case 'butterfly':
      ellipse(8,8,5,5,A);ellipse(16,8,5,5,B);ellipse(8,16,4,4,B);ellipse(16,16,4,4,A);rect(11,6,2,14,S);star(7,8,1,H);star(17,8,1,H);break;
    case 'clock':
      ellipse(12,12,9,9,S);ellipse(12,12,7,7,L);line(12,7,12,12,INK,2);line(12,12,17,14,INK,2);star(12,12,1,A);break;
    case 'bottle':
      rect(9,4,6,5,L);rect(7,10,10,10,B);rect(8,13,8,6,A);rect(10,4,4,2,H);rect(9,16,3,2,H);break;
    case 'egg':ellipse(12,14,7,8,L);ellipse(10,10,3,4,H);rect(15,17,3,2,A);break;
    case 'leaf':
      ellipse(11,12,8,7,B);line(6,19,17,5,S,2);line(11,15,18,16,L);line(10,12,6,10,L);break;
    case 'ghost':
      ellipse(12,10,7,7,H);rect(5,10,14,10,L);rect(5,19,3,2,S);rect(11,19,3,2,S);rect(17,19,3,2,S);rect(8,11,2,3,INK);rect(15,11,2,3,INK);break;
    case 'battery':
      rect(6,5,12,16,S);rect(7,8,10,11,B);rect(10,3,4,3,INK);line(13,9,10,14,H,2);line(10,14,14,14,H,2);break;
    case 'planet':
      ellipse(12,12,7,7,B);ellipse(10,9,3,3,L);line(2,16,22,10,A,2);line(3,18,20,13,H,1);break;
    case 'shell':
      ellipse(12,14,8,7,B);for(let x=7;x<18;x+=4)line(12,7,x,19,L,1);rect(6,19,12,2,S);break;
    case 'key':
      ellipse(8,8,5,5,B);ellipse(8,8,2,2,H);line(11,12,19,20,S,3);rect(17,18,4,2,A);break;
    case 'toaster':
      rect(5,7,14,13,S);rect(6,8,12,10,B);rect(8,5,8,4,INK);rect(9,6,6,3,H);rect(7,16,8,2,L);rect(17,12,3,2,A);break;
    case 'dragon':
      ellipse(12,13,7,6,B);ellipse(17,7,3,4,L);line(15,8,19,3,S,2);line(12,9,8,4,A,2);line(9,17,4,20,S,3);rect(17,11,2,2,INK);rect(19,14,2,2,H);break;
    case 'skull':
      ellipse(12,10,7,7,L);rect(7,13,10,7,H);rect(8,11,3,3,INK);rect(14,11,3,3,INK);rect(11,16,2,2,S);line(9,19,16,19,S);break;
    case 'crown':
      rect(4,13,16,7,B);line(5,12,4,6,S,3);line(9,13,12,4,L,3);line(18,12,19,6,S,3);rect(5,16,14,2,A);rect(11,15,3,3,H);break;
    case 'train':
      rect(5,8,14,11,B);rect(5,12,14,5,S);rect(7,10,4,3,H);rect(13,10,4,3,H);rect(9,5,6,4,B);rect(7,18,4,3,INK);rect(15,18,4,3,INK);break;
    case 'car':
      rect(3,12,18,7,B);rect(6,8,12,6,S);rect(8,9,4,3,H);rect(14,9,3,3,L);rect(5,17,4,4,INK);rect(16,17,4,4,INK);break;
    case 'noodles':
      rect(5,12,14,8,B);rect(4,12,16,3,S);for(let i=7;i<18;i+=3)line(i,7,i+1,13,L,2);rect(7,17,10,2,H);break;
    case 'lantern':
      rect(7,8,10,12,S);rect(8,10,8,8,A);rect(10,12,4,5,H);line(9,7,12,4,B,2);line(12,4,15,7,B,2);rect(6,18,12,2,INK);break;
    case 'compass':
      ellipse(12,12,9,9,S);ellipse(12,12,7,7,L);line(8,16,16,8,B,2);line(16,8,13,14,A,2);rect(11,11,2,2,INK);break;
    case 'camera':
      rect(4,9,16,12,B);rect(7,6,6,4,S);ellipse(12,15,5,5,INK);ellipse(12,15,3,3,L);rect(17,11,2,2,A);break;
    case 'trophy':
      rect(8,6,8,10,B);line(6,7,3,12,S,2);line(18,7,21,12,S,2);rect(11,15,3,5,S);rect(7,20,11,2,A);star(12,9,2,H);break;
    case 'gift':
      rect(5,9,14,12,B);rect(4,7,16,4,L);rect(11,7,3,14,A);rect(6,13,12,2,H);line(12,8,7,4,S,2);line(12,8,17,4,S,2);break;
    case 'music':
      line(13,5,13,17,S,2);line(13,5,19,7,A,2);line(19,7,19,15,S,2);ellipse(10,18,4,3,B);ellipse(16,16,4,3,B);break;
    case 'sushi':
      ellipse(12,14,9,6,S);ellipse(12,12,9,5,H);rect(6,12,12,4,B);rect(6,10,12,3,A);
      rect(8,11,3,2,L);rect(15,10,3,2,L);rect(8,18,9,2,S);break;
    case 'taco':
      ellipse(12,14,9,7,A);rect(5,14,14,3,B);line(5,13,19,13,S,2);rect(7,10,3,2,L);
      rect(13,10,4,2,L);rect(9,9,3,2,B);break;
    case 'icecream':
      ellipse(12,8,6,6,L);ellipse(10,6,3,3,H);ellipse(16,9,4,3,A);
      line(6,13,12,21,S,4);line(18,13,12,21,B,4);rect(8,12,8,2,S);break;
    case 'cheese':
      line(4,10,20,6,A,3);line(4,10,5,19,B,3);line(20,6,19,19,B,3);
      rect(5,12,14,7,L);ellipse(10,14,2,2,A);ellipse(16,16,2,2,A);break;
    case 'berry':
      ellipse(12,13,7,8,A);line(8,7,12,4,S,3);line(12,4,16,7,S,3);
      for(const [x,y] of [[9,11],[14,10],[11,15],[15,16],[8,17]])dot(x,y,H);break;
    case 'apple':
      ellipse(9,13,5,7,A);ellipse(15,13,5,7,B);rect(11,4,2,5,S);line(13,6,18,5,L,3);
      rect(8,10,3,4,H);break;
    case 'phone':
      rect(7,3,10,19,S);rect(8,5,8,14,B);rect(9,6,6,10,H);rect(11,19,2,1,L);
      rect(10,8,4,3,A);break;
    case 'helicopter':
      ellipse(11,14,8,5,B);rect(18,13,4,2,S);rect(5,12,4,2,H);
      line(12,8,12,6,S);line(4,6,20,6,S,2);line(8,20,18,20,INK,2);
      line(8,18,8,21,S);line(17,18,17,21,S);break;
    case 'dinosaur':
      ellipse(11,16,7,5,B);rect(14,8,4,7,B);ellipse(17,7,4,4,L);
      line(6,16,3,10,S,3);rect(7,20,3,2,S);rect(14,20,3,2,S);
      dot(18,6,INK);break;
    case 'cactus':
      rect(10,5,5,16,B);rect(6,11,4,4,B);rect(5,8,3,5,L);rect(15,13,4,4,B);
      rect(18,8,3,7,L);ellipse(12,5,3,3,L);rect(5,21,14,1,S);break;
    case 'castle':
      rect(5,9,14,12,B);rect(7,7,3,5,S);rect(14,7,3,5,S);
      rect(5,6,4,3,B);rect(15,6,4,3,B);rect(10,15,4,6,INK);
      rect(7,11,3,2,H);rect(15,11,3,2,H);break;
    case 'pancakes':
      for(let y=10;y<=18;y+=3)ellipse(12,y,9,3,y===10?L:B);
      rect(10,7,5,3,A);line(14,7,16,15,A);break;
    case 'umbrella':
      ellipse(12,11,9,6,B);line(4,13,20,13,S,2);
      line(12,9,12,19,S,2);line(12,19,16,20,S,2);
      rect(7,9,3,2,L);rect(14,9,3,2,H);break;
    case 'fox':
      ellipse(12,13,7,6,B);line(6,12,5,5,S,3);line(18,12,19,5,S,3);
      ellipse(12,15,5,3,L);rect(8,12,2,2,INK);rect(15,12,2,2,INK);
      rect(11,15,2,2,A);line(16,19,21,17,S,3);break;
    case 'bread':
      ellipse(12,12,9,7,B);rect(5,12,14,7,B);rect(7,9,10,7,L);
      rect(8,12,3,2,H);rect(14,13,3,2,H);line(6,19,18,19,S,2);break;
    case 'delight':
      // Rosewater lokum, cubic translucent candies in a small tray.
      rect(3,16,18,5,S);rect(4,15,16,3,L);
      rect(5,9,7,7,A);rect(13,8,7,8,B);rect(6,10,5,4,L);rect(14,9,5,4,H);
      rect(7,11,2,2,H);rect(16,11,2,2,H);rect(5,17,15,1,A);break;
    case 'cereal':
      ellipse(12,15,9,6,S);ellipse(12,12,8,5,L);ellipse(12,12,6,3,H);
      for(const [x,y] of [[8,10],[11,11],[15,10],[17,12],[9,13]])rect(x,y,2,2,A);
      line(17,6,20,13,INK,2);break;
    case 'cookie':
      ellipse(12,12,9,8,B);ellipse(11,10,7,6,L);
      for(const [x,y] of [[8,8],[15,9],[10,14],[16,16],[6,13]])rect(x,y,2,2,S);
      rect(8,7,2,2,H);break;
    case 'donut':
      ellipse(12,13,9,7,S);ellipse(12,11,9,6,B);ellipse(12,11,6,4,A);
      ellipse(12,12,3,3,INK);ellipse(12,12,2,2,H);
      for(const [x,y] of [[7,8],[16,8],[17,13],[8,15]])line(x,y,x+2,y+1,L);break;
    case 'steak':
      ellipse(12,14,9,7,S);ellipse(11,12,8,6,B);ellipse(9,11,4,3,L);
      ellipse(15,14,3,3,A);rect(16,13,2,2,H);line(6,17,12,19,H);break;
    case 'pie':
      rect(4,13,16,7,B);line(4,11,20,11,S,3);ellipse(12,11,8,5,A);
      for(const [x,y] of [[8,8],[13,9],[17,11]])rect(x,y,2,2,H);
      rect(5,18,14,2,S);break;
    case 'candle':
      rect(8,10,8,11,B);rect(9,11,6,8,L);rect(11,7,2,4,INK);
      ellipse(12,6,3,4,A);rect(11,4,2,3,H);
      rect(6,21,12,1,S);break;
    case 'sandwich':
      line(4,8,20,8,B,4);rect(5,11,14,3,A);rect(5,14,14,3,S);
      line(4,18,20,18,L,3);rect(7,7,4,2,H);rect(14,16,3,2,H);break;
    case 'dumpling':
      ellipse(12,14,9,6,S);ellipse(12,12,8,6,L);
      for(let x=7;x<=17;x+=3)line(x,9,x+1,13,B,1);
      rect(8,18,8,2,A);rect(10,8,2,2,H);break;
    case 'soda':
      rect(7,8,10,13,B);rect(8,9,8,10,A);rect(8,6,9,3,S);
      line(14,7,17,3,L,2);rect(10,12,2,2,H);rect(14,15,2,2,H);
      rect(10,19,5,2,L);break;
    case 'curio':case 'relic':case 'creature':case 'mechanism':case 'crystal':{
      // Fresh name-driven pixel art, NOT one of five reused "mystery" icons.
      // Compose a silhouette, asymmetrical profile, inset details and secondary
      // markings from the full discovery name. Stable across device/reloads.
      const kind=seed%7;
      const width=4+((seed>>>6)%6),height=5+((seed>>>12)%5);
      const mid=11+((seed>>>9)%3);
      if(kind===0){ // mechanical relic with offset tower and lens
        rect(12-width/2,11-height/2,width+3,height+7,S);
        rect(14,6,4+(seed%3),5,B);rect(10,5,3,4,L);
        ellipse(10,14,3,3,A);ellipse(10,14,1,1,H);
        rect(5,17,4,3,B);
      }else if(kind===1){ // asymmetrical horned specimen
        ellipse(12,14,width,6,B);ellipse(8,11,4,4,L);
        line(8,8,5-(seed%2),4,S,2);line(16,9,19,3,A,3);
        rect(8,14,2,2,INK);rect(15,12,2,2,INK);
        line(17,17,20,20,S,2);
      }else if(kind===2){ // glass artifact with layered core
        line(mid,3,5,13,S,3);line(mid,3,20,13,B,3);
        line(5,13,mid,21,B,4);line(20,13,mid,21,S,4);
        ellipse(mid,13,3,4,A);rect(mid-1,10,2,4,H);
      }else if(kind===3){ // relic on asymmetric supports
        rect(5,12,15,6,S);rect(6,11,13,6,B);
        rect(8,7,6+seed%4,5,L);rect(12,4,3,4,A);
        rect(4,18,4,3,INK);rect(16,18,4,3,INK);
        rect(10,13,2,2,H);rect(16,13,2,2,A);
      }else if(kind===4){ // plant/alien shape, no arbitrary emoji
        rect(11,11,3,10,S);ellipse(9,10,5,6,B);
        ellipse(16,12,5,4,A);line(12,11,18,5,L,2);
        ellipse(17,6,3,3,H);rect(6,15,4,2,L);
      }else if(kind===5){ // glider/feathered discovery
        line(3,10,12,6,B,4);line(12,6,21,11,S,4);
        ellipse(12,12,4,7,L);rect(11,8,2,6,A);
        line(12,17,7,21,S);line(12,17,17,21,B);
      }else{ // miniature architecture, staggered roofs
        rect(5,11,8,10,B);rect(13,9,7,12,S);
        line(4,11,10,5,L,3);line(10,5,15,11,L,3);
        line(12,9,17,4,A,2);line(17,4,21,9,A,2);
        rect(9,14,2,4,H);rect(15,13,3,3,L);
      }
      // Unique surface geometry from its full name: each unknown discovery
      // gets its own silhouette accents, not just a recolored placeholder.
      const side=seed&1?4:19;
      const marks=2+(seed>>>18)%5;
      for(let i=0;i<marks;i++){
        const n=(seed>>>(i*4))&15;
        const px=5+(n%14),py=7+((n+i*5)%13);
        if(i%3===0)rect(px,py,2,1,H);
        else if(i%3===1)dot(px,py,A);
        else rect(px,py,1,2,L);
      }
      if((seed>>>24)&1)star(side,7,1,A);
      break;
    }
  }
  // Original details are deterministically authored for each combination:
  // even uncommon names sharing a silhouette receive individualized markings.
  // Keep all decoration inside the sprite boundary and preserve transparency.
  const detail=(seed>>>10)%5;
  const x=6+(seed>>>15)%12, y=6+(seed>>>20)%10;
  if(detail===0){dot(x,y,H);dot(x+1,y,H);dot(x,y+1,A);}
  else if(detail===1){star(x,y,1,A);dot(x+3,y+5,L);}
  else if(detail===2){rect(x,y,2,2,A);dot(x+4,y+1,H);}
  else if(detail===3){line(x,y,x+3,y+2,L);dot(x+2,y+4,H);}
  else {dot(x,y,A);dot(x+4,y-2,H);dot(x+2,y+4,L);}
  const matched=PATTERNS.filter(([re])=>re.test(name));
  if(matched.length>1 && matched[0][1]!==matched[1][1]){
    // Two recognisable ingredient concepts leave a distinct hybrid hallmark,
    // rather than simply stamping the exact same art for every pair.
    const motif=matched[1][1];
    if(['fire','sun','star','gem','moon'].includes(motif))star(19,5,2,A);
    else if(['water','cloud','snow','wind'].includes(motif)){line(17,5,20,8,A,2);dot(19,10,H);}
    else if(['tree','leaf','flower','mushroom'].includes(motif)){line(19,5,17,10,S);rect(17,5,3,2,L);}
    else if(['robot','battery','camera','mechanism'].includes(motif)){rect(18,5,3,3,INK);dot(19,6,H);}
    else {rect(18,5,3,3,A);dot(19,6,H);}
  }
  // One-pixel ink border, precise readable silhouette at 24/48/96px.
  const outlined=[...pixels];
  for(let y=1;y<23;y++)for(let x=1;x<23;x++) {
    const i=y*w+x;if(pixels[i])continue;
    if(pixels[i-1]||pixels[i+1]||pixels[i-w]||pixels[i+w])outlined[i]=INK;
  }
  let rects='';
  for(let y=0;y<h;y++){for(let x=0;x<w;){const c=outlined[y*w+x];if(!c){x++;continue}
    let length=1;while(x+length<w&&outlined[y*w+x+length]===c)length++;
    rects+=`<rect x="${x}" y="${y}" width="${length}" height="1" fill="${c}"/>`;x+=length;
  }}
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 24 24" shape-rendering="crispEdges">${rects}</svg>`;
  const url='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
  if(CACHE.size>=500)CACHE.delete(CACHE.keys().next().value!);
  CACHE.set(key,url);
  return url;
}
