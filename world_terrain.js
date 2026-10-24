// Map Game 0.3.2A3 — shared terrain data, authoritative in both 2D maps.
// All positions are in GLOBAL METERS; local territories translate first.
// Pure deterministic functions: no network access, no mutable per-territory seed.
(() => {
  "use strict";
  const SIZE = 32768;
  const DEFAULT_SEED = 734221;
  function clamp(v,a=0,b=1){return Math.max(a,Math.min(b,v));}
  function smooth(v){v=clamp(v);return v*v*(3-2*v);}
  function hash(x,y,s){
    let n = Math.imul((x|0)^s, 374761393) ^ Math.imul((y|0)^0x632be59b,668265263);
    n=Math.imul(n^(n>>>13),1274126177); n^=n>>>16;
    return (n>>>0)/4294967295;
  }
  function noise(x,y,scale,seed){
    x/=scale;y/=scale;const ix=Math.floor(x),iy=Math.floor(y);
    const a=smooth(x-ix),b=smooth(y-iy);
    const v0=hash(ix,iy,seed)*(1-a)+hash(ix+1,iy,seed)*a;
    const v1=hash(ix,iy+1,seed)*(1-a)+hash(ix+1,iy+1,seed)*a;
    return v0*(1-b)+v1*b;
  }
  function octave(x,y,scale,seed,count=3){
    let v=0,weight=1,total=0;
    for(let k=0;k<count;k++){
      v+=weight*noise(x,y,scale,seed+k*733);
      total+=weight;weight*=.5;scale*=.5;
    }
    return v/total;
  }
  function readSeed(){
    try {const v=Number(localStorage.getItem('mapgame_world_seed'));return Number.isFinite(v)&&v!==0 ? v|0 : DEFAULT_SEED;}
    catch(_){return DEFAULT_SEED;}
  }
  const seed=readSeed();
  function sample(x,y){
    // 350km-scale landform, 90km mountain belts, 8km local detail.
    // Global meter coordinates guarantee continuity between territories.
    const continent=octave(x,y,350000,seed+101,3);
    const base=octave(x,y,105000,seed+211,3);
    const spine=noise(x,y,138000,seed+311);
    const mountainMask=smooth((spine-.43)/.20);
    const r=noise(x,y,48000,seed+411);
    const ridge=Math.pow(1-Math.abs(r*2-1),2.5)*mountainMask;
    const hills=octave(x,y,18000,seed+521,3);
    const micro=noise(x,y,3400,seed+631);
    const elevation=clamp(.18+(.38*continent)+(.21*base)+(.36*ridge)+(.10*(hills-.5))+.025*(micro-.5));
    const moisture=clamp(.60*octave(x,y,140000,seed+711,3)+.40*octave(x,y,24000,seed+811,3));
    const temperature=clamp(.73*octave(x,y,320000,seed+911,3)+.27*(1-elevation));
    const steepness=clamp(ridge*.95+Math.max(0,elevation-.56)*1.5);
    const water=elevation<.32;
    const forest=water?0:clamp((moisture-.35)*1.55+.30*noise(x,y,11000,seed+1021)-steepness*.52);
    const rock=clamp(smooth((elevation-.50)/.25)*.75+steepness*.65);
    const snow=clamp(smooth((elevation-.75)/.15)*smooth((.69-temperature)/.19));
    const dry=clamp(smooth((.48-moisture)/.24)*(1-rock));
    const wet=clamp(smooth((moisture-.59)/.24)*smooth((.49-elevation)/.20));
    const soil=clamp(.06+(hills-.5)*.12);
    const rockyGrass=clamp(steepness*.42+(rock*.30));
    const grass=clamp((1-rock)*(1-dry*.7)*(1-wet*.5));
    let terrain='grassland';
    if(water)terrain='water';
    else if(snow>.48)terrain='snow_peak';
    else if(rock>.80)terrain='high_rock';
    else if(rock>.52)terrain='mountain';
    else if(rockyGrass>.25)terrain='hills';
    else if(dry>.56)terrain='dry_plains';
    else if(wet>.45)terrain='wet_grassland';
    else if(forest>.65)terrain='forest';
    return {elevation,moisture,temperature,ridge,steepness,forest,water,terrain,
      weights:{grass,rockyGrass,rock,snow,dry,wet,soil},
      buildability:water?'BLOCKED':steepness>.78?'VERY DIFFICULT':steepness>.54?'DIFFICULT':steepness>.32?'GOOD':'EXCELLENT'};
  }
  function strategic(x,y){
    const s=sample((x+.5)*SIZE,(y+.5)*SIZE);
    return {...s, mountain:s.terrain==='mountain'||s.terrain==='high_rock'||s.terrain==='snow_peak',
      hills:s.terrain==='hills',dry:s.terrain==='dry_plains',wetland:s.terrain==='wet_grassland',
      snow:s.terrain==='snow_peak', kind:({grassland:'plains',dry_plains:'dry',wet_grassland:'wetland',
       high_rock:'mountain',snow_peak:'snow'}[s.terrain]||s.terrain),forestDensity:s.forest,
       forest:s.terrain==='forest'};
  }
  function local(tx,ty,x,y){return sample(tx*SIZE+x,ty*SIZE+y);}
  window.mapGameSharedTerrain={VERSION:'0.3.2A3',SIZE,seed,sample,strategic,local};
})();