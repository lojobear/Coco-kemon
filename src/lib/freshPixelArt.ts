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
  |'curio'|'relic'|'creature'|'mechanism'|'crystal'|'chair'|'sofa'|'table'|'lamp'|'arcade'|'cabinet'|'aquarium'|'bed'|'television'|'glassblowing'|'rations'|'glassware'|'meal'|'instrument'|'painting'|'camera'|'vehicle'|'telescope'|'toolkit'|'gift';
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
 animal:{base:'#dfaa83',light:'#f9d9a7',shade:'#a77870',accent:'#e98086',bright:'#fff1c9'},
  furni:{base:'#38b5bd',light:'#abf1ee',shade:'#277887',accent:'#fb8bc0',bright:'#f8fffd'},
  lounge:{base:'#ba78ce',light:'#e4adf3',shade:'#694ca2',accent:'#7fddc9',bright:'#ffffff'},
  glass:{base:'#49cfda',light:'#d4fcff',shade:'#3986c2',accent:'#f27343',bright:'#ffffff'},
  rations:{base:'#6db4d8',light:'#d7f6ed',shade:'#344b8b',accent:'#f3bc4d',bright:'#ffffff'},
  stationery:{base:'#f0739e',light:'#fce4ec',shade:'#a74694',accent:'#ffd65e',bright:'#ffffff'}
};
const PATTERNS:Array<[RegExp,Form,keyof typeof PALETTES]>=[

 [/\b(?:glassblow(?:ing|er|n)?|blowpipe|molten glass|glass furnace)\b/i,'glassblowing','glass'],
 [/\b(?:space rations?|astronaut (?:food|meal)|ration packs?|survival rations?|meal ready to eat|mre)\b/i,'rations','rations'],
 [/\b(?:glassware|vase|decanter|carafe|goblet|wineglass|tumbler|flask|beaker)\b/i,'glassware','glass'],
 [/\b(?:meal|dinner|lunch|supper|breakfast platter|feast|snack|bento|rations?|cuisine|banquet)\b/i,'meal','food'],
 [/\b(?:violin|guitar|ukulele|drum|harp|flute|trumpet|harmonica|piano|instrument)\b/i,'instrument','lounge'],
 [/\b(?:painting|portrait|artwork|canvas|easel|mural)\b/i,'painting','stationery'],
 [/\b(?:camera|photograph|video recorder)\b/i,'camera','tech'],
 [/\b(?:car|truck|train|bicycle|motorcycle|bus|vehicle|boat|wagon)\b/i,'vehicle','tech'],
 [/\b(?:telescope|observatory|microscope|lens|binoculars)\b/i,'telescope','tech'],
 [/\b(?:tools?|wrench|hammer|saw|drill|screwdriver|workshop|forging|smithing)\b/i,'toolkit','tech'],
 [/\b(?:present|gift|surprise|parcel|package|wrapped)\b/i,'gift','stationery'],

 [/\b(?:chair|stool|armchair|throne|seat)\b/i,'chair','lounge'],
 [/\b(?:sofa|couch|loveseat|settee)\b/i,'sofa','lounge'],
 [/\b(?:table|desk|countertop|workbench)\b/i,'table','furni'],
 [/\b(?:lamp|lantern|lightbulb|light fixture)\b/i,'lamp','furni'],
 [/\b(?:arcade|pinball|slot cabinet|game machine)\b/i,'arcade','tech'],
 [/\b(?:cabinet|wardrobe|dresser|cupboard|shelf)\b/i,'cabinet','lounge'],
 [/\b(?:aquarium|fish tank|terrarium)\b/i,'aquarium','water'],
 [/\b(?:bed|mattress|bunk)\b/i,'bed','lounge'],
 [/\b(?:television|tv|monitor|display screen)\b/i,'television','tech'],
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
];
function hash(name:string):number{
  let n=2166136261;
  for(const c of name.toLowerCase()) n=Math.imul(n^c.charCodeAt(0),16777619);
  return n>>>0;
}
function pickForm(name:string):[Form,Palette]{
  for(const [pattern,form,palette] of PATTERNS)if(pattern.test(name))return [form,PALETTES[palette]];
  const n=hash(name);
  const generic:Form[]=['curio','relic','creature','mechanism','crystal'];
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
    // Semantic temporary previews: do not swap an unknown discovery for
    // a random cube, diamond or generic furniture icon.
    case 'glassblowing':
      // Long diagonal blowpipe with the molten orange glass bulb and two
      // reflective cyan-glass flares, not a solid cube.
      line(4,5,15,15,S,2);line(5,4,16,14,H);
      ellipse(17,16,4,4,A);ellipse(16,15,3,3,B);
      rect(15,13,2,2,L);rect(18,18,2,1,H);
      line(12,10,17,16,S);break;
    case 'rations':
      // An open foil food pouch, yellow nutrient block and distinct blue water
      // sachet, rather than a generic space diamond/plate.
      rect(5,7,11,12,S);rect(6,8,9,10,B);
      rect(7,9,7,3,H);rect(8,13,6,4,A);
      rect(5,6,11,2,L);rect(16,10,5,9,S);
      rect(17,11,3,6,L);rect(17,13,2,2,H);
      rect(7,10,3,1,INK);break;
    case 'glassware':
      ellipse(12,7,6,3,S);rect(7,7,11,10,B);
      rect(8,11,9,4,L);ellipse(12,17,5,3,S);
      rect(9,8,2,5,H);rect(15,10,1,5,H);break;
    case 'meal':
      ellipse(12,15,9,5,S);ellipse(12,14,7,3,L);
      ellipse(9,12,3,3,B);ellipse(15,12,3,2,A);
      rect(6,9,4,2,H);rect(13,10,3,2,B);break;
    case 'instrument':
      ellipse(11,14,6,7,B);ellipse(11,11,4,4,L);
      rect(12,3,3,9,S);rect(13,4,1,7,H);
      rect(10,10,1,8,INK);rect(15,12,1,7,INK);break;
    case 'painting':
      rect(4,6,16,13,S);rect(6,8,12,9,L);
      line(7,15,12,9,B,3);line(12,9,18,15,A,3);
      rect(7,9,3,2,H);line(12,19,8,22,B);line(12,19,16,22,B);break;
    case 'camera':
      rect(4,9,16,11,S);rect(5,10,14,8,B);
      ellipse(12,13,5,5,INK);ellipse(12,13,3,3,A);
      rect(5,7,6,3,L);rect(17,10,2,2,H);break;
    case 'vehicle':
      rect(4,10,16,8,B);rect(7,7,9,5,L);
      rect(9,8,5,3,H);ellipse(8,18,3,3,INK);
      ellipse(17,18,3,3,INK);rect(20,13,2,3,A);break;
    case 'telescope':
      line(5,8,17,13,B,4);line(15,13,21,15,L,3);
      line(11,12,11,20,S,2);line(11,14,6,21,S);
      line(11,14,16,21,S);rect(5,7,2,3,H);break;
    case 'toolkit':
      rect(4,11,16,10,B);rect(5,12,14,8,S);
      rect(8,7,8,4,L);rect(9,8,6,2,H);
      rect(6,13,12,3,A);rect(11,14,2,2,INK);break;
    case 'gift':
      rect(5,9,14,12,B);rect(4,8,16,4,L);
      rect(10,9,4,12,A);rect(4,8,16,2,H);
      ellipse(9,6,4,3,A);ellipse(15,6,4,3,A);break;
    // Habbo-like local previews for recognizable furni nouns. This is only a
    // temporary client-side icon, not a completed or saved AI generation.
    case 'chair':
      rect(7,6,10,11,S);rect(8,6,8,8,B);rect(9,7,6,3,L);
      rect(7,14,11,3,B);rect(7,17,3,5,S);rect(15,17,3,5,S);
      rect(8,13,3,2,L);break;
    case 'sofa':
      rect(4,9,16,9,S);rect(5,8,14,6,B);rect(6,8,6,4,L);rect(13,8,5,4,A);
      rect(3,13,18,6,B);rect(5,18,3,4,S);rect(17,18,3,4,S);
      rect(6,14,12,2,L);break;
    case 'table':
      line(4,11,12,6,L,3);line(12,6,20,11,L,3);
      line(4,11,12,16,B,3);line(12,16,20,11,B,3);
      rect(5,14,3,7,S);rect(16,14,3,7,S);line(11,10,16,12,H);break;
    case 'lamp':
      ellipse(12,10,7,4,B);rect(6,8,12,2,L);rect(11,13,2,7,S);
      ellipse(12,20,6,2,B);rect(9,7,6,2,H);break;
    case 'arcade':
      rect(6,5,12,16,S);rect(7,6,9,10,B);rect(8,7,7,6,A);
      rect(8,8,5,4,H);rect(7,15,10,4,L);rect(10,16,2,2,INK);
      rect(9,20,2,2,S);rect(15,20,2,2,S);break;
    case 'cabinet':
      rect(5,6,14,15,S);rect(6,5,12,2,L);rect(6,8,5,11,B);
      rect(12,8,6,11,A);rect(9,13,1,3,H);rect(13,13,1,3,H);
      rect(6,20,3,2,S);rect(16,20,3,2,S);break;
    case 'aquarium':
      rect(4,7,16,14,S);rect(5,8,14,11,B);rect(7,9,10,7,L);
      ellipse(12,13,4,2,A);rect(8,12,2,1,H);rect(5,20,14,2,INK);break;
    case 'bed':
      rect(5,7,5,12,S);rect(8,9,12,9,B);rect(9,11,10,6,L);
      rect(9,10,5,4,H);rect(5,18,15,3,S);rect(6,20,2,2,S);
      rect(18,20,2,2,S);break;
    case 'television':
      rect(5,6,14,13,S);rect(7,8,10,9,B);rect(8,9,8,6,A);
      rect(9,10,4,3,H);rect(10,19,4,2,INK);rect(7,21,10,1,S);break;
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
    case 'curio':case 'relic':case 'creature':case 'mechanism':case 'crystal':{
      // Unknown concepts are NOT representable using 5 random shapes. The
      // previous fallback made unrelated items look like cubes/plates/gems.
      // Display an intentionally recognizable "artwork not ready" brush
      // emblem rather than pretending we generated a meaningful sprite.
      const accent = seed % 2 ? A : B;
      rect(5,6,14,14,S);rect(6,7,12,12,L);
      rect(7,8,10,8,H);rect(8,9,7,6,B);
      line(7,17,17,8,INK,3);line(9,18,19,8,accent,2);
      rect(16,5,3,3,H);dot(18,4,accent);
      break;
    }
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
