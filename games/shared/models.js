export function rng(seed) { let x = seed >>> 0 || 1; return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return (x >>> 0) / 4294967296; }; }
function shuffle(a,random){for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
const DIRS = [[1,0],[0,1],[-1,0],[0,-1]];
const key = ([x,y]) => `${x},${y}`;
export function blocker(level, arrow, removed = []) {
  const occupied = new Map();
  for (const a of level.arrows) if (!removed.includes(a.id) && a.id !== arrow.id) for (const p of a.cells) occupied.set(key(p), a.id);
  const [dx,dy] = arrow.dir; let [x,y] = arrow.cells.at(-1);
  for (x += dx, y += dy; x >= 0 && y >= 0 && x < level.size && y < level.size; x += dx, y += dy) if (occupied.has(`${x},${y}`)) return {id:occupied.get(`${x},${y}`),cell:[x,y]};
  return null;
}
export function makeLevel(index) {
  if (index === 0) return {size:6, arrows:[{id:0,cells:[[0,2],[1,2],[2,2]],dir:[1,0]},{id:1,cells:[[4,3],[4,2],[4,1]],dir:[0,-1]},{id:2,cells:[[1,4],[2,4],[3,4],[3,5]],dir:[0,1]}]};
  const random = rng(90211 + index * 7919), size = index < 6 ? 7 : index < 16 ? 8 : 9;
  const arrows = [], occupied = new Set(), target = 5 + Math.floor(index * .48);
  for (let tries = 0; tries < 6000 && arrows.length < target; tries++) {
    const dir = DIRS[Math.floor(random()*4)]; const head = [Math.floor(random()*size),Math.floor(random()*size)];
    if (occupied.has(key(head))) continue;
    const ray = new Set(); let [x,y]=head;
    for (x+=dir[0],y+=dir[1];x>=0&&y>=0&&x<size&&y<size;x+=dir[0],y+=dir[1])ray.add(`${x},${y}`);
    if ([...ray].some(p=>occupied.has(p)))continue;
    const cells=[head], own=new Set([key(head)]), len=2+Math.floor(random()*(index<4?3:5));
    let backward=[-dir[0],-dir[1]];
    for(let n=1;n<len;n++){
      const options=n===1?[backward]:[backward,...shuffle(DIRS.filter(d=>d!==backward),random)];
      const next=options.map(d=>({d,p:[cells[0][0]+d[0],cells[0][1]+d[1]]})).find(({p})=>p[0]>=0&&p[1]>=0&&p[0]<size&&p[1]<size&&!occupied.has(key(p))&&!own.has(key(p))&&!ray.has(key(p)));
      if(!next)break; cells.unshift(next.p);own.add(key(next.p));backward=next.d;
    }
    if(cells.length<2)continue;
    const arrow={id:arrows.length,cells,dir};arrows.push(arrow);cells.forEach(p=>occupied.add(key(p)));
  }
  return {size,arrows};
}
export const LEVELS=Array.from({length:30},(_,i)=>makeLevel(i));
export const SHAPES=[[[0,0]],[[0,0],[1,0]],[[0,0],[0,1]],[[0,0],[1,0],[2,0]],[[0,0],[0,1],[0,2]],[[0,0],[1,0],[0,1],[1,1]],[[0,0],[0,1],[1,1]],[[0,0],[1,0],[0,1]],[[0,0],[1,0],[1,1]],[[1,0],[0,1],[1,1]],[[0,0],[1,0],[2,0],[3,0]],[[0,0],[0,1],[0,2],[0,3]],[[0,0],[1,0],[2,0],[1,1]],[[0,0],[0,1],[1,1],[2,1]],[[0,0],[1,0],[2,0],[2,1]],[[0,0],[1,0],[0,1],[1,1],[0,2],[1,2]],[[0,0],[1,0],[2,0],[0,1],[1,1],[2,1]]];
export function fits(grid,shape,x,y){return !!shape&&Number.isInteger(x)&&Number.isInteger(y)&&shape.every(([dx,dy])=>x+dx>=0&&x+dx<8&&y+dy>=0&&y+dy<8&&!grid[(y+dy)*8+x+dx]);}
export function positions(grid,shape){const out=[];for(let y=0;y<8;y++)for(let x=0;x<8;x++)if(fits(grid,shape,x,y))out.push([x,y]);return out;}
export function isOver(state){return !state.hand.some(id=>id!==null&&positions(state.grid,SHAPES[id]).length);}
export function deal(state){
  const random=rng(state.seed); state.hand=Array.from({length:3},()=>Math.floor(random()*SHAPES.length));state.seed=Math.floor(random()*4294967296)||1;
  if(isOver(state)) {const fitting=SHAPES.map((_,i)=>i).filter(i=>positions(state.grid,SHAPES[i]).length);if(fitting.length)state.hand[0]=fitting[Math.floor(random()*fitting.length)];}
}
export function newBlock(seed=Date.now()>>>0,tutorial=false,best=0){
  const state={grid:Array(64).fill(0),hand:[],score:0,best,streak:0,seed:seed||1,turns:0,tutorial};
  if(tutorial){for(let x=0;x<6;x++)state.grid[7*8+x]=1;state.hand=[1,5,6];}else deal(state);return state;
}
export function place(state,slot,x,y){
  const id=state.hand[slot];if(id===null||id===undefined||!fits(state.grid,SHAPES[id],x,y))return null;
  const next=structuredClone(state);const shape=SHAPES[id];for(const [dx,dy]of shape)next.grid[(y+dy)*8+x+dx]=slot+2;
  const rows=[],cols=[];
  for(let i=0;i<8;i++){if(Array.from({length:8},(_,j)=>next.grid[i*8+j]).every(Boolean))rows.push(i);if(Array.from({length:8},(_,j)=>next.grid[j*8+i]).every(Boolean))cols.push(i);}
  const cleared=[];for(let y1=0;y1<8;y1++)for(let x1=0;x1<8;x1++)if(rows.includes(y1)||cols.includes(x1)){cleared.push(y1*8+x1);next.grid[y1*8+x1]=0;}
  const lines=rows.length+cols.length;next.streak=lines?next.streak+1:0;
  const gain=shape.length*10+100*lines*lines+(lines?50*(next.streak-1):0);next.score+=gain;next.best=Math.max(next.best,next.score);next.turns++;next.tutorial=false;next.hand[slot]=null;if(next.hand.every(v=>v===null))deal(next);
  return {state:next,lines,gain,cleared,over:isOver(next)};
}
export function validBlock(s){return s&&Array.isArray(s.grid)&&s.grid.length===64&&s.grid.every(v=>Number.isInteger(v)&&v>=0&&v<=4)&&Array.isArray(s.hand)&&s.hand.length===3&&s.hand.every(v=>v===null||Number.isInteger(v)&&v>=0&&v<SHAPES.length)&&['score','best','streak','seed','turns'].every(k=>Number.isSafeInteger(s[k])&&s[k]>=0)&&s.best>=s.score;}
