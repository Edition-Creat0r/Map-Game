// Derived statistics only; preserves each measured interval and long task.
const fs=require('node:fs'),path=require('node:path');
function summarize(report){
 const median=values=>{const a=[...values].sort((a,b)=>a-b),i=Math.floor(a.length/2);return a.length%2?a[i]:(a[i-1]+a[i])/2;};
 const stats=a=>({median:median(a),min:Math.min(...a),max:Math.max(...a)});
 for(const row of report.rows){
  if(row.startupLongTasks){row.throughWarmupLongTasks=row.startupLongTasks;delete row.startupLongTasks;}
  for(const key of ['static','orbit']){const m=row[key];if(!m.intervals)continue;const a=m.intervals,s=[...a].sort((a,b)=>a-b);m.frameSamples=a.length;m.meanFrameMs=a.reduce((a,b)=>a+b,0)/a.length;m.p95FrameMs=s[Math.min(s.length-1,Math.floor(s.length*.95))];m.fps=1000/m.meanFrameMs;}
 }
 report.summary=[];
 for(const count of [10,50,100,250])for(const variant of ['baseline','kenney-comparison','quaternius']){
  const rows=report.rows.filter(r=>r.count===count&&r.variant===variant);if(!rows.length)continue;
  report.summary.push({count,variant,runs:rows.length,startupMs:stats(rows.map(r=>r.startupMs)),fps:stats(rows.map(r=>r.static.fps)),p95FrameMs:stats(rows.map(r=>r.static.p95FrameMs)),orbitFPS:stats(rows.map(r=>r.orbit.fps)),orbitP95Ms:stats(rows.map(r=>r.orbit.p95FrameMs)),longTaskCounts:rows.map(r=>r.static.longTasks.length),maxLongTasks:rows.map(r=>Math.max(0,...r.static.longTasks)),drawCalls:rows.map(r=>r.static.drawCalls)});
 }
 return report;
}
module.exports={summarize};
if(require.main===module){const file=process.argv[2]||path.join(__dirname,'../evidence/performance.json'),report=summarize(JSON.parse(fs.readFileSync(file)));fs.writeFileSync(file,JSON.stringify(report,null,2)+'\n');for(const r of report.summary)console.log(r.count,r.variant,'FPS',r.fps.median.toFixed(2),'p95',r.p95FrameMs.median.toFixed(1),'startup',r.startupMs.median.toFixed(0));}
