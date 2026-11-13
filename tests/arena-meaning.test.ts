import test from 'node:test';import assert from 'node:assert/strict';
import { qualifiedConceptName, displayConceptName } from '../src/lib/conceptMeaning';
import { arenaCards } from '../src/lib/arena';
import { BOT_DEFINITIONS, seedBot, botOpponent } from '../src/lib/botCollectors';
import { validNewElementName, makePairKey } from '../src/lib/infiniteCraftData';
import { collectionDisplayCategory } from '../src/lib/collectionCategories';
import { discoveryIdentity } from '../src/lib/unifiedCollection';
test('different senses retain separate names, recipe keys and categories',()=>{
 const grill=qualifiedConceptName('Smoker','Barbecue meat and brisket');const person=qualifiedConceptName('Smoker','A person who uses tobacco cigarettes');
 assert.equal(grill,'Smoker (barbecue)');assert.equal(person,'Smoker (cigarettes)');assert.notEqual(discoveryIdentity(grill),discoveryIdentity(person));assert.notEqual(makePairKey(grill,'Fire'),makePairKey(person,'Fire'));
 assert.equal(collectionDisplayCategory({name:grill}),'Tools & Objects');assert.equal(collectionDisplayCategory({name:person}),'People & Professions');
 assert.equal(collectionDisplayCategory({name:'Python (programming)'}),'Technology');assert.equal(collectionDisplayCategory({name:'Python (snake)'}),'Animals');
 assert.equal(displayConceptName({name:'Smoker'}),'Smoker (unspecified)');
 assert.equal(qualifiedConceptName('Smoker','Smoke'),'Smoker');assert.equal(qualifiedConceptName('Smoker','Barbecue and tobacco'),'Smoker');
 assert.equal(qualifiedConceptName('Pizza','Barbecue'),'Pizza');assert.equal(qualifiedConceptName('Constructor','computer'),'Constructor');assert.equal(displayConceptName({name:'Constructor'}),'Constructor');assert.equal(qualifiedConceptName(grill,'Tobacco'),grill);
 assert.equal(validNewElementName('Smoker (barbecue)'),true);assert.equal(validNewElementName('Three Word Concept (computer device)'),true);assert.equal(validNewElementName('Four Word Concept Name (animal)'),false);
});
test('legacy meaning labels do not rename saved concepts and Arena scores come from the guide',()=>{
 const old={id:'old',name:'Smoker',emoji:'✨',explanation:'A barbecue grill for brisket.',craftCount:1};
 assert.equal(displayConceptName(old),'Smoker (barbecue)');assert.equal(old.name,'Smoker');
 const cards=arenaCards([old,{...old,id:'duplicate'}, {id:'other',name:'Smoker (cigarettes)',emoji:'✨'}]);assert.equal(cards.length,2);assert.ok(cards.every(card=>Number.isSafeInteger(card.coins)&&card.coins>0));assert.equal(cards[0].key,'smoker');assert.equal(cards[0].category,'Tools & Objects');
 const bot=BOT_DEFINITIONS[0],state=seedBot(bot,1000);
 assert.ok(botOpponent(bot,state,'Animals')?.cards.length);assert.ok(botOpponent(bot,state,'Food & Drink')?.cards.every(card=>card.category==='Food & Drink'));
});
