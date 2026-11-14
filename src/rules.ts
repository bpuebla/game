export const WORLD = 14400;
export const FLOOR = 620;
export const ARENA = 12600;
export type ChaseState = 'hidden' | 'chase' | 'windup' | 'pounce' | 'dizzy' | 'defeated';
export function roomAt(x: number): string { return x < 4800 ? 'THE LIVING ROOM' : x < 9600 ? 'THE HALLWAY' : 'THE KITCHEN'; }
export function resolveCrash(crashes: number) { const count = Math.min(3, crashes + 1); return { count, state: (count === 3 ? 'defeated' : 'dizzy') as ChaseState }; }
export function collect(id: number, collected: Set<number>) { if (collected.has(id)) return 0; collected.add(id); return 10; }
export function resetEncounter() { return { state: 'chase' as ChaseState, crashes: 0 }; }
export type Furniture = { x: number; y: number; w: number; h: number; kind: 'sofa' | 'table' | 'shelf' | 'box' | 'counter' | 'chair'; };
export const furniture: Furniture[] = [
{x:560,y:530,w:270,h:90,kind:'sofa'}, {x:950,y:420,w:180,h:25,kind:'shelf'}, {x:1220,y:520,w:150,h:100,kind:'table'},
{x:1820,y:405,w:190,h:25,kind:'shelf'}, {x:2150,y:515,w:220,h:105,kind:'table'}, {x:2510,y:425,w:160,h:25,kind:'shelf'},
{x:2860,y:525,w:330,h:95,kind:'sofa'}, {x:3390,y:500,w:120,h:120,kind:'box'}, {x:3690,y:400,w:210,h:25,kind:'shelf'}, {x:4100,y:530,w:260,h:90,kind:'sofa'},
{x:4970,y:525,w:150,h:95,kind:'box'}, {x:5280,y:420,w:200,h:25,kind:'shelf'}, {x:5680,y:520,w:190,h:100,kind:'table'},
{x:6090,y:525,w:120,h:95,kind:'box'}, {x:6370,y:420,w:190,h:25,kind:'shelf'}, {x:6740,y:520,w:150,h:100,kind:'chair'},
{x:7140,y:515,w:190,h:105,kind:'table'}, {x:7500,y:410,w:220,h:25,kind:'shelf'}, {x:7970,y:525,w:150,h:95,kind:'box'},
{x:8330,y:440,w:200,h:25,kind:'shelf'}, {x:8700,y:530,w:240,h:90,kind:'table'}, {x:9220,y:520,w:160,h:100,kind:'box'},
{x:9810,y:530,w:230,h:90,kind:'chair'}, {x:10120,y:420,w:340,h:200,kind:'counter'}, {x:10800,y:520,w:230,h:100,kind:'chair'},
{x:11120,y:410,w:400,h:210,kind:'counter'}, {x:11820,y:520,w:230,h:100,kind:'chair'}, {x:12120,y:420,w:260,h:200,kind:'counter'},
];
export const gaps: [number,number][] = [[3910,4060],[6900,7060],[8980,9150]];
export const STOOLS = [12830, 13550] as const;
export const CHARGE_SPEED = 950;
export const CANELO_PATROLS = [{min:1540,max:1700},{min:7808,max:7878},{min:10565,max:10695}] as const;
export function canChargeAt(x:number, feet:number, grounded:boolean) {
  return grounded && feet>=FLOOR-8 && x>STOOLS[0]+55 && x<STOOLS[1]-55;
}
