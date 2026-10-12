import {finite} from './analytics.js?v=20261003d';

export function renderTrajectoryChart(node,cfg){
 const {esc,fmt,series}=cfg,W=Math.max(260,Math.floor(node.clientWidth)),mobile=W<560;
 const H=mobile?380:430,L=mobile?53:68,R=20,T=24,B=60;
 const points=series.flatMap(s=>s.points.filter(p=>finite(p.x)&&finite(p.y)).map(p=>({...p,iso:s.iso,name:s.name,color:s.color})));
 if(!points.length){node.innerHTML='<div class="chart-empty">No complete outcome–financing pairs for this selection.<br>Try another baseline, annual spending, or actual values.</div>';return;}
 const xmax=Math.max(...points.map(p=>p.x),cfg.indexed?100:0),ymax=Math.max(...points.map(p=>p.y),cfg.indexed?100:0);
 const xhi=xmax>0?xmax*1.14:1,yhi=ymax>0?ymax*1.13:1;
 const sx=x=>L+x/xhi*(W-L-R),sy=y=>H-B-y/yhi*(H-B-T);
 const tick=v=>Math.abs(v)>=1000?new Intl.NumberFormat('en',{notation:'compact',maximumFractionDigits:1}).format(v):fmt(v,v<10?1:0);
 const text=(x,y,value,extra='')=>`<text x="${x}" y="${y}" ${extra}>${esc(value)}</text>`;
 let svg=`<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" aria-label="${esc(cfg.aria)}"><title>${esc(cfg.aria)}</title>`;
 for(let j=0;j<=4;j++){
  const y=yhi*j/4,x=xhi*j/4;
  svg+=`<line class="grid" x1="${L}" y1="${sy(y)}" x2="${W-R}" y2="${sy(y)}"/>`+text(L-9,sy(y)+4,tick(y),'text-anchor="end"');
  svg+=text(sx(x),H-B+22,tick(x),'text-anchor="middle"');
 }
 if(cfg.indexed)svg+=`<path class="trajectory-baseline" d="M${sx(100)},${T}V${H-B}M${L},${sy(100)}H${W-R}"/>`;
 svg+=`<path class="axis" d="M${L},${T}V${H-B}H${W-R}"/>`;
 svg+=text(L,14,'Y · Financing','class="axis-title"')+text((L+W-R)/2,H-8,'X · Outcome'+(cfg.indexed?` (${cfg.start} = 100)`:''),'text-anchor="middle" class="axis-title"');
 for(const s of series){
  let path='',previous=null;
  for(const p of s.points){if(!finite(p.x)||!finite(p.y)){previous=null;continue;}path+=(previous&&p.year-previous.year===5?'L':'M')+sx(p.x)+','+sy(p.y);previous=p;}
  if(path)svg+=`<path data-trajectory-series="${s.iso}" d="${path}" fill="none" stroke="${s.color}" stroke-width="2.3" stroke-linejoin="round"/>`;
 }
 const labels=[],obstacles=points.map(p=>({x:sx(p.x)-6,y:sy(p.y)-6,w:12,h:12}));
 const overlap=(a,b)=>a.x<b.x+b.w+3&&a.x+a.w+3>b.x&&a.y<b.y+b.h+2&&a.y+a.h+2>b.y;
 points.forEach((p,j)=>{
  const x=sx(p.x),y=sy(p.y),own=series.find(s=>s.iso===p.iso),ends=own.points.filter(v=>finite(v.x)&&finite(v.y));
  const tip=`${p.name}, ${p.year}. Outcome: ${fmt(p.outcome)}. Financing: ${fmt(p.financing)}.${cfg.indexed?` Plotted indices: X ${fmt(p.x)}, Y ${fmt(p.y)}.`:''}`;
  const last=p.year===ends.at(-1).year;
  svg+=`<circle data-trajectory-point="${j}" data-country-code="${p.iso}" data-point-year="${p.year}" data-x="${p.x}" data-y="${p.y}" cx="${x}" cy="${y}" r="${last?5.5:4.2}" fill="${last?p.color:'#fff'}" stroke="${p.color}" stroke-width="2" tabindex="0" role="button" aria-label="${esc(tip)}"><title>${esc(tip)}</title></circle>`;
  if(mobile&&p.year!==ends[0].year&&!last)return;
  const candidates=[[9,-19],[-39,-19],[9,6],[-39,6],[-16,-28],[-16,15],[18,-7],[-52,-7]];
  for(const [dx,dy] of candidates){const box={x:x+dx,y:y+dy,w:31,h:13};if(box.x<L+2||box.x+box.w>W-R||box.y<T||box.y+box.h>H-B-2||[...labels,...obstacles].some(b=>overlap(box,b)))continue;labels.push(box);svg+=text(box.x,box.y+11,p.year,`class="trajectory-year" style="fill:${p.color}"`);break;}
 });
 node.innerHTML=svg+'</svg><div class="trajectory-inspector" aria-live="polite"></div>';
 const inspect=j=>{
  const p=points[j];if(!p)return;
  node.querySelectorAll('[data-trajectory-point]').forEach(el=>el.classList.toggle('active-point',+el.dataset.trajectoryPoint===j));
  node.querySelector('.trajectory-inspector').innerHTML=`<strong style="color:${p.color}">${esc(p.name)} · ${p.year}</strong><span><b>X · Outcome:</b> ${fmt(p.x)} ${esc(cfg.xUnit)}</span><span><b>Y · Financing:</b> ${fmt(p.y)} ${esc(cfg.yUnit)}</span><small>Hover, tap or tab to a dot. Filled dots mark each country's last available point.</small>`;
 };
 const event=e=>{const p=e.target.closest('[data-trajectory-point]');if(p)inspect(+p.dataset.trajectoryPoint);};
 node.onpointerover=event;node.onclick=event;node.onfocusin=event;
 node.onkeydown=e=>{if(['Enter',' '].includes(e.key)){event(e);e.preventDefault();}};
 inspect(points.findLastIndex(p=>p.iso===series[0].iso)>=0?points.findLastIndex(p=>p.iso===series[0].iso):points.length-1);
}
