import { makePairKey } from './infiniteCraftData.js';

// Reachable conceptual routes; associations are game logic, not physical chemistry.
const recipes = [
  ['Water','Spark','Life','🌱','science'],
  ['Life','Earth','Animal','🐾','biology'],
  ['Animal','Water','Fish','🐟','biology'],
  ['Animal','Wind','Bird','🐦','biology'],
  ['Animal','House','Dog','🐕','biology'],
  ['Animal','Cheese','Mouse','🐭','biology'],
  ['Mouse','Spark','Pikachu','⚡','character'],
  ['Pikachu','Animal','Pokémon','🔴','pop-culture'],
  ['Bird','Ice','Penguin','🐧','biology'],
  ['Earth','Earth','Land','🏞️','geography'],
  ['Land','Land','Continent','🌍','geography'],
  ['Continent','Maple','Canada','🇨🇦','geography'],
  ['Water','Earth','Mud','🟤','science'],
  ['Mud','Fire','Brick','🧱','science'],
  ['Brick','Brick','House','🏠','function'],
  ['Life','Water','Plant','🌿','biology'],
  ['Plant','Fire','Tea','🍵','food'],
  ['Plant','House','Garden','🌻','function'],
  ['Fish','Fire','Grilled Fish','🐟','food'],
  ['Coffee','Canada','Tim Hortons','☕','brand'],
  ['Coffee','Mermaid','Starbucks','☕','brand'],
  ['Burger','Clown',"McDonald's",'🍔','brand'],
  ['Plumber','Mushroom','Mario','🍄','character'],
  ['Sponge','Ocean','SpongeBob','🧽','character'],
  ['Mouse','Cartoon','Mickey Mouse','🐭','character'],
  ['Robot','Space','R2-D2','🤖','character'],
] as const;
export const CULTURE_RECIPES = Object.fromEntries(recipes.map(([a,b,result,emoji,connection]) => [makePairKey(a,b), { result, emoji, connection, explanation: `${a} + ${b} connects to ${result}.` }]));
