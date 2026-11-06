// Build-time only, pinned MIT meshoptimizer. Receives geometry data, never code.
const fs=require('node:fs'),{MeshoptSimplifier:S}=require('meshoptimizer');
(async()=>{await S.ready;const input=JSON.parse(fs.readFileSync(0,'utf8')),out=[];for(const g of input){
 const positions=new Float32Array(g.positions),normals=new Float32Array(g.normals),uv=new Float32Array(g.uv),indices=new Uint32Array(g.indices),lookup=new Map(),remap=[],p=[],attrs=[];
 for(let i=0;i<positions.length/3;i++){
  const key=[...positions.slice(i*3,i*3+3),...normals.slice(i*3,i*3+3),...uv.slice(i*2,i*2+2)].map(v=>v.toFixed(6)).join('/');
  if(!lookup.has(key)){lookup.set(key,p.length/3);p.push(...positions.slice(i*3,i*3+3));attrs.push(...normals.slice(i*3,i*3+3),...uv.slice(i*2,i*2+2));}
  remap[i]=lookup.get(key);
 }
 const welded=indices.map(i=>remap[i]),target=Math.max(3,Math.floor(Math.min(indices.length*g.ratio,g.maxIndices)/3)*3);
 const [reduced,error]=S.simplifyWithAttributes(welded,new Float32Array(p),3,new Float32Array(attrs),5,[.15,.15,.15,.5,.5],null,target,g.error,['Prune']);
 // Return original vertex indices: high/medium/far share original coordinates,
 // normals and UVs. No relaxed vertex positions or projected icon textures.
 const originals=[];for(let i=0;i<remap.length;i++)if(originals[remap[i]]===undefined)originals[remap[i]]=i;
 out.push({indices:Array.from(reduced,i=>originals[i]),error});
 }process.stdout.write(JSON.stringify(out));})().catch(e=>{console.error(e.message);process.exitCode=1});
