// Responsive multi-series chart. The readout exposes exact years and denominators.
export function renderTrendChart(node,cfg){
 const {fmt,esc}=cfg,W=Math.max(260,Math.floor(node.clientWidth)),H=W<600?315:345,L=W<600?49:61,R=20,T=27,B=45;
 const series=cfg.series,all=series.flatMap(s=>s.points).filter(p=>Number.isFinite(p.y));
 if(!all.length){node.innerHTML='<div class="chart-empty">No comparable trend for this selection.<br>Try another baseline, or use countries available each year.</div>';return;}
 let ymin=cfg.scale==='change'?Math.min(0,...all.map(p=>p.y))*1.12:0;
 let ymax=Math.max(0,...all.map(p=>p.y),cfg.reference??0)*1.13;
 if(ymax===ymin)ymax=ymin+1;
 const sx=x=>cfg.start===cfg.end?(L+W-R)/2:L+(x-cfg.start)/(cfg.end-cfg.start)*(W-L-R);
 const sy=y=>H-B-(y-ymin)/(ymax-ymin)*(H-B-T);
 const text=(x,y,label,attr='')=>`<text x="${x}" y="${y}" ${attr}>${esc(label)}</text>`;
 let svg=`<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" tabindex="0" role="img" aria-label="${esc(cfg.aria)}. Use left and right arrow keys to inspect years."><title>${esc(cfg.aria)}</title>`;
 for(let i=0;i<5;i++){const v=ymin+(ymax-ymin)*i/4,y=sy(v);svg+=`<line class="grid" x1="${L}" y1="${y}" x2="${W-R}" y2="${y}"/>`+text(L-9,y+4,fmt(v,Math.max(Math.abs(ymax),Math.abs(ymin))<10?1:0),'text-anchor="end"');}
 const ticks=[...new Set([cfg.start,Math.round(cfg.start+(cfg.end-cfg.start)/3),Math.round(cfg.start+2*(cfg.end-cfg.start)/3),cfg.end])];
 for(const year of ticks)svg+=text(sx(year),H-B+21,String(year),'text-anchor="middle"');
 svg+=`<path class="axis" d="M${L} ${T}V${H-B}H${W-R}"/>`+text((L+W-R)/2,H-3,'Year','text-anchor="middle"');
 if(Number.isFinite(cfg.reference))svg+=`<line class="target" x1="${L}" x2="${W-R}" y1="${sy(cfg.reference)}" y2="${sy(cfg.reference)}"/>`+text(W-R-3,sy(cfg.reference)-7,cfg.referenceLabel,'text-anchor="end" class="target-text"');
 // Context first; the focal country remains visible where curves overlap.
 for(const s of [...series].reverse()){
   let path='',previous=null;
   for(const p of s.points){if(!Number.isFinite(p.y)){previous=null;continue;}path+=(previous===p.x-1?'L':'M')+sx(p.x)+','+sy(p.y);previous=p.x;}
   svg+=`<path data-series="${s.group}" d="${path}" fill="none" stroke="${s.color}" stroke-width="${s.group==='country'?3.1:2.1}" ${s.dash?`stroke-dasharray="${s.dash}"`:''}/>`;
   for(const p of s.points.filter(p=>Number.isFinite(p.y))){svg+=`<circle cx="${sx(p.x)}" cy="${sy(p.y)}" r="${s.group==='country'?3.1:2.2}" fill="${s.color}"><title>${esc(s.label)} · ${p.year}: ${fmt(p.y)} ${esc(cfg.unit)}; source value ${fmt(p.raw)}; ${p.n} ${s.group==='country'?'country':'peers'}</title></circle>`;}
 }
 svg+=`<line class="inspect-line" x1="${sx(cfg.end)}" x2="${sx(cfg.end)}" y1="${T}" y2="${H-B}" stroke="#758696" stroke-width="1" stroke-dasharray="2 4"/></svg>`;
 node.innerHTML=svg+'<div class="trend-inspector"><p class="inspect-year"></p><div class="inspect-values"></div></div>';
 const svgNode=node.querySelector('svg'),line=node.querySelector('.inspect-line'),heading=node.querySelector('.inspect-year'),readout=node.querySelector('.inspect-values');
 let activeYear=cfg.end;
 const inspect=year=>{
  activeYear=Math.min(cfg.end,Math.max(cfg.start,year));line.setAttribute('x1',sx(activeYear));line.setAttribute('x2',sx(activeYear));
  heading.textContent=activeYear+' · '+cfg.unit+' · hover, tap or use arrow keys';
  readout.innerHTML=series.map(s=>{const p=s.points.find(p=>p.year===activeYear);return `<div class="inspect-item"><span class="inspect-label"><i style="background:${s.color}"></i>${esc(s.short)}</span><strong>${fmt(p?.y)}</strong><span class="small">${s.group==='country'?(cfg.scale!=='level'?'Source: '+fmt(p?.raw):'Selected country'):p?.n+' / '+s.eligible+' peers'}${cfg.scale!=='level'&&s.group!=='country'?' · source '+fmt(p?.raw):''}</span></div>`;}).join('');
 };
 function inspectPointer(e){const rect=svgNode.getBoundingClientRect(),x=(e.clientX-rect.left)*W/rect.width;inspect(Math.round(cfg.start+(x-L)/(W-L-R)*(cfg.end-cfg.start)));}
 svgNode.addEventListener('pointermove',inspectPointer);svgNode.addEventListener('pointerdown',inspectPointer);
 svgNode.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();inspect(e.key==='Home'?cfg.start:e.key==='End'?cfg.end:activeYear+(e.key==='ArrowRight'?1:-1));}});
 inspect(cfg.end);
}
