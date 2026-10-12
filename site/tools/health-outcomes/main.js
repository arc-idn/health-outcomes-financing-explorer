import {trendView} from './trend-view.js?v=20261003d';
import {renderTrendChart} from './trend-chart.js?v=20261003d';
import {trajectoryView} from './trajectory-view.js?v=20261003d';
import {renderTrajectoryChart} from './trajectory-chart.js?v=20261003d';
import {finite,at,financeAt,latest,median,peerIsos,pairs,change,assess,csv} from './analytics.js?v=20261003d';

const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=(v,n=1)=>finite(v)?v.toLocaleString('en',v!==0&&Math.abs(v)<0.1?{maximumSignificantDigits:3}:{maximumFractionDigits:n,minimumFractionDigits:n}):'Not available';
const sign=v=>finite(v)?(v>0?'+':'')+fmt(v):'Not available';
const tabs={trends:'Country trends',targets:'MDGs & SDGs',compare:'Financing comparison',data:'Data & methods'};
const groups=['Health outcomes','Service coverage','Financial protection','Nutrition & living conditions'];
const finances=['gghed_gdp','gghed_gge','gghed_che','oops_che','che_gdp','che_ppp_pc','gghed_ppp_pc','che_usd2023_pc','che_pc_usd'];
const peerLabels={asean:'ASEAN (11 countries)',income:'Same income group',region:'Same World Bank region',world:'All countries'};
let D,C,F,K,M,S,chartJobs=[],downloadRows=[],trajectoryRows=[];

function readState(){
 const q=new URLSearchParams(location.search), num=(k,d,min,max)=>{const v=Number(q.get(k));return q.has(k)&&Number.isInteger(v)&&v>=min&&v<=max?v:d;};
 const iso=D.countries[q.get('iso')]?q.get('iso'):'IDN', indicator=D.indicators[q.get('indicator')]?q.get('indicator'):'u5';
 const year=num('year',2023,1990,2024);
 const extra={priceBasis:q.get('priceBasis')==='nominal'?'nominal':'real',countries:[...new Set((q.get('countries')??'THA~MYS').split('~'))].filter(k=>k!==iso&&D.countries[k]).slice(0,7).join('~'),trajectoryScale:q.get('trajectoryScale')==='index'?'index':'level',spendingMode:q.get('spendingMode')==='cumulative'?'cumulative':'annual',spendingComponent:['current','capital','total'].includes(q.get('spendingComponent'))?q.get('spendingComponent'):'selected'};
 if(extra.spendingMode==='cumulative'){extra.priceBasis='real';if(extra.spendingComponent==='selected')extra.spendingComponent='current';}
 return{...extra,view:tabs[q.get('view')]?q.get('view'):'trends',iso,indicator,year,start:Math.min(num('start',2003,1990,2023),year),finance:finances.includes(q.get('finance'))?q.get('finance'):'gghed_gdp',peers:peerLabels[q.get('peers')]?q.get('peers'):'asean',lag:[0,3,5].includes(+q.get('lag'))?+q.get('lag'):0,framework:q.get('framework')==='mdg'?'mdg':'sdg',scale:['level','index','change'].includes(q.get('scale'))?q.get('scale'):'level',cohort:q.get('cohort')==='available'?'available':'balanced',benchmarks:q.has('benchmarks')?q.get('benchmarks').split('~').filter(k=>['region','income','world','asean'].includes(k)).join('~'):'region~income~world~asean'};
}
function urlFor(patch={}){return '?'+new URLSearchParams({...S,...patch}).toString();}
function update(patch){S={...S,...patch};if(S.start>S.year)S.start=S.year;history.pushState({},'',urlFor());render();}
function options(items,value){return items.map(([v,l])=>`<option value="${esc(v)}" ${String(v)===String(value)?'selected':''}>${esc(l)}</option>`).join('');}
function select(key,label,items,value=S[key]){return `<label>${esc(label)}<select data-state="${key}" aria-label="${esc(label)}">${options(items,value)}</select></label>`;}
function ind(){return D.indicators[S.indicator];}
function fin(){return M.indicators[S.finance];}
function fval(iso,y){return financeAt(C,F,iso,S.finance,y);}
function actions(){return '<div class="actions"><button data-action="download">Download CSV</button><button data-action="share">Copy link</button><button data-action="print">Print / PDF</button></div>';}
function section(kicker,title,description){return `<div class="section-head"><div><p class="eyebrow">${esc(kicker)}</p><h2>${esc(title)}</h2><p>${description}</p></div>${actions()}</div>`;}
function stat(label,value,sub){return `<div class="stat"><div class="label">${esc(label)}</div><strong>${esc(value)}</strong><span>${esc(sub)}</span></div>`;}
function source(i=ind()){return `<p class="source">Source: <a href="${esc(i.url)}">${esc(i.source)}</a> · ${esc(i.code)} · source update: ${esc(i.last_updated)}.</p>`;}
function finSource(){return '<p class="source">Source: <a href="https://apps.who.int/nha/database">WHO GHED, May 2026 extract</a>. Financing coverage begins in 2000; 2024 observations are preliminary.</p>';}
function table(headers,rows,caption=''){return `<div class="table-wrap"><table>${caption?`<caption>${caption}</caption>`:''}<thead><tr>${headers.map(h=>`<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;}
function metricCell(v,year){return `<td class="num">${fmt(v)}${finite(v)&&year!=null?`<span class="small">${year}</span>`:''}</td>`;}
function chart(id,config){chartJobs.push([id,config]);return `<div class="chart" id="${id}" role="${config.series?'group':'img'}" aria-label="${esc(config.aria)}"></div>`;}
function linearChart(node,cfg){
 const W=Math.max(260,Math.floor(node.clientWidth)),H=285,L=57,R=18,T=20,B=47;
 const pts=cfg.points.filter(p=>finite(p.x)&&finite(p.y));
 if(!pts.length){node.innerHTML='<div class="chart-empty">Not available for the selected years.<br>Choose another year or indicator.</div>';return;}
 const xlo=cfg.minX??0,xhi=cfg.maxX??Math.max(...pts.map(p=>p.x))*1.1;
 const maxY=Math.max(...pts.map(p=>p.y),cfg.target??0), yhi=maxY>0?maxY*1.15:1;
 const sx=x=>L+(x-xlo)/(xhi-xlo||1)*(W-L-R), sy=y=>H-B-y/yhi*(H-B-T);
 const t=(x,y,label,extra='')=>`<text x="${x}" y="${y}" ${extra}>${esc(label)}</text>`;
 let svg=`<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg"><title>${esc(cfg.aria)}</title>`;
 for(let i=0;i<=4;i++){const v=yhi*i/4,y=sy(v);svg+=`<line class="grid" x1="${L}" y1="${y}" x2="${W-R}" y2="${y}"/>`+t(L-9,y+4,fmt(v,v<10?1:0),'text-anchor="end"');}
 const ticks=cfg.kind==='line'?Array.from(new Set([xlo,Math.round(xlo+(xhi-xlo)/3),Math.round(xlo+2*(xhi-xlo)/3),xhi])):Array.from({length:4},(_,i)=>xlo+(xhi-xlo)*i/3);
 for(const x of ticks)svg+=t(sx(x),H-B+21,cfg.kind==='line'?String(x):fmt(x,xhi<15?1:0),'text-anchor="middle"');
 svg+=`<path class="axis" d="M${L},${T}V${H-B}H${W-R}"/>`;
 svg+=t((W+L-R)/2,H-5,cfg.kind==='line'?'Year':cfg.xUnit,'text-anchor="middle"');
 if(finite(cfg.target)){svg+=`<line class="target" x1="${L}" x2="${W-R}" y1="${sy(cfg.target)}" y2="${sy(cfg.target)}"/>`+t(W-R-3,sy(cfg.target)-7,cfg.targetLabel||'2030 threshold','text-anchor="end" class="target-text"');}
 if(cfg.kind==='line'){
   let path='',last=null;
   for(const p of cfg.points){if(!finite(p.y)){last=null;continue;}path+=(last!==null&&p.x===last+1?'L':'M')+sx(p.x)+','+sy(p.y);last=p.x;}
   svg+=`<path class="series" d="${path}"/>`;
 }
 for(const p of pts){
  const focus=p.iso===S.iso&&cfg.kind!=='line',tip=`${p.name||D.countries[S.iso].name}: ${cfg.kind==='line'?p.x+'; ':''}${fmt(p.y)} ${cfg.yUnit}${cfg.kind==='scatter'?`; financing ${fmt(p.x)} ${cfg.xUnit}, ${p.financeYear}; outcome ${p.year}`:''}`;
  svg+=`<circle class="${focus?'focus':'dot'}" cx="${sx(p.x)}" cy="${sy(p.y)}" r="${focus?6:cfg.kind==='line'?3:4}" ${cfg.kind==='scatter'?`data-iso="${esc(p.iso)}" tabindex="0" role="button" aria-label="${esc(tip)}; select country"`:''}><title>${esc(tip)}</title></circle>`;
  if(focus)svg+=t(Math.min(W-R-4,sx(p.x)+8),Math.max(14,sy(p.y)-11),p.iso,`text-anchor="${sx(p.x)>W-75?'end':'start'}" font-weight="bold"`);
 }
 node.innerHTML=svg+'</svg>';
}
function renderCharts(){for(const [id,cfg] of chartJobs){const node=$(id);if(node){if(cfg.kind==='trajectory')renderTrajectoryChart(node,cfg);else if(cfg.series)renderTrendChart(node,cfg);else linearChart(node,cfg);}}}
function makeTrajectory(){const result=trajectoryView({D,C,F,K,M,S,esc,fmt,chart,source,finSource,table});trajectoryRows=result.rows;return result;}
// Retain the controls in the DOM while redrawing only the chart and readings.
// This preserves an open country picker, its search, scroll position and focus.
function updateTrajectory(patch){
 S={...S,...patch};if(S.spendingMode==='cumulative'){S.priceBasis='real';if(S.spendingComponent==='selected')S.spendingComponent='current';}
 history.pushState({},'',urlFor());
 document.querySelectorAll('#tabs a[data-view]').forEach(n=>n.href=urlFor({view:n.dataset.view}));
 chartJobs=chartJobs.filter(([id])=>id!=='trend-trajectory');
 const result=makeTrajectory();$('trajectory-result').innerHTML=result.result;
 const root=$('trajectory-section');
 root.querySelectorAll('[data-trajectory-country]').forEach(n=>{n.checked=result.isos.includes(n.dataset.trajectoryCountry);n.disabled=n.dataset.trajectoryCountry===S.iso||result.isos.length===8&&!n.checked;});
 root.querySelector('[data-selection-count]').textContent=result.isos.length+'/8 selected';
 root.querySelectorAll('[data-trajectory-key]').forEach(n=>{const price=n.dataset.trajectoryKey==='priceBasis';n.setAttribute('aria-pressed',String(!(price&&S.spendingComponent==='selected')&&S[n.dataset.trajectoryKey]===n.dataset.value));if(price)n.disabled=S.spendingComponent==='selected'||S.spendingMode==='cumulative'&&n.dataset.value==='nominal';});
 root.querySelector('.trajectory-price-help').textContent=result.priceHelp;
 const metric=root.querySelector('[data-trajectory-select]');metric.value=S.spendingComponent;metric.querySelector('[value=selected]').disabled=S.spendingMode==='cumulative';
 const cfg=chartJobs.find(([id])=>id==='trend-trajectory')[1];renderTrajectoryChart($('trend-trajectory'),cfg);
}
function trends(){
 const result=trendView({D,C,F,M,S,esc,fmt,sign,select,actions,chart,source,finSource,table,trajectory:makeTrajectory});
 downloadRows=result.rows;
 return result.html;
}
function targets(){
 const mdg=S.framework==='mdg',baseline=mdg?1990:2015,c=D.countries[S.iso],until=mdg?2015:S.year;
 if(!mdg&&S.year<2015){downloadRows=[['country','note'],[c.name,'Select 2015 or later for the SDG period']];return section('Development goals',c.name+': SDGs','The SDG period begins in 2015.')+'<div class="note">Choose an outcome year from 2015 onward. <button class="plain-link" data-year="2015">Use 2015</button>, or select the MDG framework below.</div><div class="inline-controls">'+select('framework','Development framework',[['sdg','SDGs · 2015–2030'],['mdg','MDGs · 1990–2015']])+'</div>';}
 const indicators=Object.values(D.indicators), rows=[],exported=[];
 for(const i of indicators){const a=at(D,S.iso,i.id,baseline),p=mdg?{year:2015,value:at(D,S.iso,i.id,2015)}:latest(D,S.iso,i.id,until),b=p?.value,delta=change(a,b),evaluation=assess(D,S.iso,i.id,S.framework,until),target=D.targets[S.framework][i.id];
  rows.push(`<tr><td><button class="plain-link" data-indicator="${i.id}">${esc(i.label)}</button><span class="small">${esc(i.unit)}<br>${esc(mdg?i.mdg:i.sdg)}</span></td>${metricCell(a,finite(a)?baseline:null)}${metricCell(b,finite(b)?p.year:null)}<td>${delta?sign(delta.absolute):'Not available'}<span class="small">${delta?(i.unit.includes('%')?'percentage points':i.id==='uhc'?'index points':'in indicator units'):''}</span></td><td>${target?`<a href="${esc(target.url)}">${esc(target.label)}</a>${finite(evaluation.target)?`<span class="small">Threshold: ${fmt(evaluation.target)}</span>`:''}`:'Track direction; no numeric threshold applied'}</td><td><span class="status ${evaluation.kind}">${esc(evaluation.status)}</span><span class="small">${esc(evaluation.note)}</span></td></tr>`);
  exported.push([S.iso,c.name,i.code,i.label,i.unit,mdg?i.mdg:i.sdg,baseline,a,p?.year??'',b,delta?.absolute??'',evaluation.target??'',evaluation.status,i.url]);
 }
 downloadRows=[['iso3','country','indicator','label','unit','framework_mapping','baseline_year','baseline_value','endpoint_year','endpoint_value','absolute_change','threshold','assessment','source_url'],...exported];
 return section('From the MDGs to the SDGs',c.name+': development goals',mdg?'Review the fixed 1990–2015 MDG window using the current source vintage. Historical estimates may differ from those available when the MDGs ended.':`Track change from 2015 to the latest observation available by ${S.year}. Every endpoint carries its own year; this is a country scorecard, not a mixed-year country ranking.`)+
 `<div class="inline-controls">${select('framework','Development framework',[['sdg','SDGs · 2015–2030'],['mdg','MDGs · 1990–2015']])}</div>`+
 `<div class="note"><p>${mdg?'The MDG assessment always uses 1990 and 2015, regardless of the year selector. Exact endpoints are required.':'Thresholds are evaluated using point estimates. A threshold already reached does not imply equal access, good care quality or achievement in every population group.'} Maternal mortality below 70 is a <strong>global</strong> SDG benchmark. A country-specific achievement label is not assigned from that benchmark.</p></div>`+
 table(['Indicator and framework link',String(baseline),mdg?'2015':`Latest by ${S.year}`,'Change','Target / benchmark','Reading'],rows)+
 `<p class="progress-legend">“No numeric assessment” means the indicator is tracked but this module does not apply a country-level threshold. Component and related measures are labelled explicitly. Safely managed water and sanitation do not use the MDG “improved” definitions. Financial hardship and UHC coverage use the revised 2025 series throughout.</p>`;
}
function compare(){
 const i=ind(),f=fin(),cohort=peerIsos(D,S.iso,S.peers),isos=[...new Set([...cohort,S.iso])],matched=pairs(D,C,F,isos,S.indicator,S.finance,S.year,S.lag),matchedPeers=matched.filter(p=>p.iso!==S.iso&&cohort.includes(p.iso)),peerCount=cohort.filter(k=>k!==S.iso).length,fy=S.year-S.lag,own=matched.find(p=>p.iso===S.iso),country=D.countries[S.iso],yearCounts=[];
 for(let y=2000+S.lag;y<=2024;y++){const n=pairs(D,C,F,isos,S.indicator,S.finance,y,S.lag).length;if(n)yearCounts.push([y,n]);}
 const best=yearCounts.sort((a,b)=>b[1]-a[1]||b[0]-a[0])[0];
 const ordered=isos.sort((a,b)=>a===S.iso?-1:b===S.iso?1:D.countries[a].name.localeCompare(D.countries[b].name));
 downloadRows=[['iso3','country','outcome_indicator','outcome_year','outcome_value','outcome_unit','financing_indicator','financing_year','financing_value','financing_unit','matched_pair','outcome_source','financing_source'],...ordered.map(iso=>[iso,D.countries[iso].name,i.code,S.year,at(D,iso,S.indicator,S.year),i.unit,S.finance,fy,fval(iso,fy),f.unit,matched.some(p=>p.iso===iso),i.url,'https://apps.who.int/nha/database'])];
 return section('Financing and health performance',i.label+' and health financing',`Compare ${esc(i.label.toLowerCase())} in <strong>${S.year}</strong> with ${esc(f.short_label.toLowerCase())} in <strong>${fy}</strong>. ${S.lag?`${S.lag}-year financing lag selected.`:'Both measures use the same year.'}`)+
 `<div class="inline-controls">${select('finance','Financing measure',finances.map(k=>[k,M.indicators[k].short_label+' ('+M.indicators[k].unit+')']))}${select('peers','Comparison group',Object.entries(peerLabels))}${select('lag','Financing precedes outcome',[['0','Same year'],['3','3 years earlier'],['5','5 years earlier']])}</div>`+
 `<div class="stats">${stat(country.name+' · outcome '+S.year,fmt(at(D,S.iso,S.indicator,S.year)),i.unit)}${stat(country.name+' · financing '+fy,fmt(fval(S.iso,fy)),f.unit)}${stat('Peers with both measures',matchedPeers.length+' / '+peerCount,'Selected country excluded from peer count')}${stat('Peer median · outcome '+S.year,fmt(median(matchedPeers.map(p=>p.y))),'Unweighted; matched peers only')}</div>`+
 `<section class="panel"><h3>Country comparison</h3><p>${esc(i.unit)}. ${i.direction==='lower'?'Lower is better for this outcome.':'Higher is better for this measure.'}</p><div class="legend"><span><i class="dot-key focus"></i>${esc(country.name)}</span><span><i class="dot-key"></i>${esc(peerLabels[S.peers])}</span><span>Select a point to change country.</span></div>${chart('scatter',{kind:'scatter',points:matched,yUnit:i.unit,xUnit:f.unit,aria:`Country comparison: ${i.label} in ${S.year} against ${f.short_label} in ${fy}`})}<p class="small">Horizontal axis: ${esc(f.short_label)} (${esc(f.unit)}). Every point requires both measures in the stated years.</p>${source()}${finSource()}</section>`+
 `${!own?`<div class="note">${esc(country.name)} has no complete pair for these years. No earlier outcome or financing value is substituted.${best?` <button class="plain-link" data-year="${best[0]}">Use ${best[0]}, with ${best[1]} complete pairs in this selection</button>.`:''}</div>`:''}`+
 `<div class="note"><p><strong>Read this as a descriptive comparison.</strong> Spending and outcomes also vary with income, age structure, disease burden, prices, service quality and institutions. This chart does not estimate a causal effect, efficiency score or return on spending. A lag changes the time alignment, not the study design.</p><p>${S.finance.includes('ppp')?'PPP spending uses current international dollars. It adjusts purchasing power across countries, not inflation over time. ':S.finance==='che_pc_usd'?'Current US dollars are affected by exchange rates and prices. ':''}${S.finance==='oops_che'?'The out-of-pocket share is a financing mix measure, not a measure of financial hardship. Select the SDG 3.8.2 outcome to examine that separately. ':''}Peer medians use complete pairs and give every country equal weight; they are not regional population estimates.</p></div>`+
 table(['Country',`${esc(i.label)}<br>${S.year} · ${esc(i.unit)}`,`${esc(f.short_label)}<br>${fy} · ${esc(f.unit)}`,'Included in chart'],ordered.map(iso=>`<tr class="${iso===S.iso?'selected':''}"><td><button class="plain-link" data-country="${iso}">${esc(D.countries[iso].name)}</button></td>${metricCell(at(D,iso,S.indicator,S.year))}${metricCell(fval(iso,fy))}<td>${matched.some(p=>p.iso===iso)?'Yes':'No: incomplete pair'}</td></tr>`),'Missing values remain visible in the table and are excluded from the chart.')+
 `<p class="small subtle">Income groups use the financing panel’s fixed 2023 classification. ASEAN uses its 11-country preset, including Timor-Leste, throughout the time series. The selected country is shown even when outside the chosen peer group.</p>`;
}
function dataView(){
 const inds=Object.values(D.indicators);downloadRows=[['indicator','label','group','unit','SDG_mapping','MDG_mapping','first_year','last_year','countries','observations','source','updated','source_url','definition'],...inds.map(i=>[i.code,i.label,i.group,i.unit,i.sdg,i.mdg,i.first_year,i.last_year,i.n_countries,i.n_observations,i.source,i.last_updated,i.url,i.note])];
 return section('Definitions and evidence','What can be compared?',`The module contains ${inds.length} indicators for the existing 195-country financing universe. Availability varies by country and indicator. Health data were retrieved on ${D.retrieved}; source update dates are listed separately.`)+
 `<section class="panel"><h3>How the trend benchmarks work</h3><p>Country trends plot the selected country with regional, same-income-group, global and ASEAN country medians. Each peer median excludes the selected country. The default sample contains the same countries in every year of the chosen period. The alternative uses countries available each year, so its composition can change. Outcome and financing samples are calculated separately.</p><p>Actual values keep the source units. Baseline = 100 divides each country or peer-median series by its own baseline value and multiplies by 100; zero or missing baselines are not indexed. Change from baseline subtracts that same baseline. The gap table uses country minus peer median in the original units. Global median means an unweighted median of country peers in this panel, not a population-weighted world estimate. The CSV includes original values, plotted values, baseline, group and yearly sample sizes.</p><p>The third plot places outcome on X and financing on Y, joining exact observations at five-year intervals from the chosen baseline. Its country picker and actual/index toggle are independent of the peer charts. Annual spending can use the selected financing measure or current expenditure, capital expenditure, or their sum, with a nominal (current US dollars) or real (constant 2023 US dollars) price basis. Both are per capita; indexing to 100 does not adjust prices. Cumulative spending uses real prices. The outcome selector in plot 3 supports all available health indicators and stays synchronised with the page selector. Cumulative spending sums every annual per-capita amount from baseline through each point year, inclusive, and requires complete intervening years. It never sums percentages. Capital is separate from current expenditure and missing capital is not treated as zero. The sum represents expenditure flows, not the value of surviving assets after depreciation. Capital observations come from the same frozen GHED workbook; their coverage is narrower than current expenditure. The trajectory CSV includes annual components, actual and indexed coordinates, completeness and source codes.</p></section><div class="method-grid"><section class="panel"><h3>1. Outcomes and service coverage</h3><p>Mortality and disease incidence describe population health. Vaccination, skilled attendance and treatment coverage describe service reach. Coverage is an output proxy, not a count of services or proof that care was effective. Nutrition, water and sanitation add context outside the health-care budget.</p></section><section class="panel"><h3>2. The same countries and years</h3><p>Financing comparisons require an exact pair: outcome in the selected year and financing in that year minus the selected lag. Missing observations are never interpolated or carried forward. The SDG scorecard separately shows the latest observation up to the chosen year, with its date.</p></section><section class="panel"><h3>3. MDG and SDG definitions</h3><p>MDG comparisons use 1990–2015. SDG change uses 2015 onward. Numeric thresholds are applied to under-five mortality, neonatal mortality and premature NCD mortality, plus the historical maternal mortality MDG. Other measures retain their mapping without an invented success threshold. Components and proxies are labelled.</p></section><section class="panel"><h3>4. Revised UHC series</h3><p>SDG 3.8.1 and 3.8.2 use the WHO 2025 revision across the full time series. The former is an index, not a population percentage. The latter measures hardship relative to a household’s discretionary budget. It is not joined to the older 10% and 25% catastrophic-spending measures.</p></section><section class="panel"><h3>5. Trends, targets and uncertainty</h3><p>Change is endpoint minus baseline; changes in percentages use percentage points. Relative change is 100 × (endpoint / baseline − 1), undefined for a zero baseline. Where shown, the required annual reduction is 100 × [1 − (target / latest value)<sup>1 / years remaining</sup>]. It is not a projection. Estimates and surveys can have uncertainty and revisions; this extract does not carry uncertainty intervals.</p></section><section class="panel"><h3>6. Financing and peer comparisons</h3><p>The existing WHO GHED financing data are read directly, without a second financing dataset. Current PPP and current US dollars are not inflation-adjusted trend measures. Constant 2023 US dollars are available. Peer medians exclude the selected country, use complete pairs and are unweighted. These comparisons do not control for need or population structure.</p></section></div>`+
 `<div class="actions"><a class="button" href="data/outcomes.csv" download>Download all outcome observations (CSV)</a><a class="button" href="data/outcomes.json" download>Download data and definitions (JSON)</a></div>`+
 table(['Indicator','Framework links','Coverage in this extract','Definition and source'],inds.map(i=>`<tr><td><button class="plain-link" data-indicator="${i.id}">${esc(i.label)}</button><span class="small">${esc(i.unit)}<br>${esc(i.group)}</span></td><td>${esc(i.sdg)}<span class="small">${esc(i.mdg)}</span></td><td class="num">${i.first_year}–${i.last_year}<span class="small">${i.n_countries} countries<br>${i.n_observations.toLocaleString('en')} observations</span></td><td>${esc(i.note)}<details class="indicator-detail"><summary>Source details</summary><p><a href="${esc(i.url)}">${esc(i.source)}</a> · ${esc(i.code)}</p><p class="small">${esc(i.producer)}</p><p class="small">Source update: ${esc(i.last_updated)} · Retrieved: ${D.retrieved}</p></details></td></tr>`))+
 `<p class="small subtle">Data licences: World Bank WDI, CC BY 4.0, with underlying producer attribution; WHO data under its applicable data-use terms. Financing source: WHO GHED (CC BY-NC-SA 3.0 IGO). Source links and dates accompany both the figures and downloads.</p>`;
}
function render(){
 document.body.dataset.view=S.view;
 chartJobs=[];$('notification').textContent='';
 $('tabs').innerHTML=Object.entries(tabs).map(([id,label])=>`<a class="tab" href="${esc(urlFor({view:id}))}" data-view="${id}" ${S.view===id?'aria-current="page"':''}>${label}</a>`).join('');
 const countries=Object.entries(D.countries).sort((a,b)=>a[1].name.localeCompare(b[1].name)).map(([k,c])=>[k,c.name]);
 $('controls').innerHTML=select('iso','Country',countries)+select('category','Indicator group',groups.map(k=>[k,k]),ind().group)+select('indicator','Health indicator',Object.values(D.indicators).filter(i=>i.group===ind().group).map(i=>[i.id,i.label]))+select('year','Outcome year',Array.from({length:35},(_,i)=>[2024-i,2024-i]));
 $('content').innerHTML=({trends,targets,compare,data:dataView})[S.view]();$('content').setAttribute('aria-busy','false');
 if(S.year===2024)$('content').insertAdjacentHTML('afterbegin','<p class="note">2024 financing data are preliminary and available for few countries. Health outcome coverage varies. Select an earlier year for a broader matched comparison.</p>');
 renderCharts();
}
function download(trajectory=false){const blob=new Blob(['\ufeff'+csv(trajectory?trajectoryRows:downloadRows)],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`health-outcomes_${S.iso}_${trajectory?'trajectory':S.view}_${S.indicator}_${S.year}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
document.addEventListener('input',e=>{if(e.target.hasAttribute('data-country-search')){const q=e.target.value.trim().toLowerCase();document.querySelectorAll('.country-choice').forEach(n=>{n.hidden=!n.dataset.countryName.includes(q);});}});
document.addEventListener('change',e=>{
 if(e.target.hasAttribute('data-trajectory-outcome')){const top=$('trajectory-section').getBoundingClientRect().top;update({indicator:e.target.value});window.scrollBy(0,$('trajectory-section').getBoundingClientRect().top-top);return;}
 if(e.target.dataset.trajectoryCountry){const isos=new Set(S.countries.split('~').filter(k=>k&&k!==S.iso));if(e.target.checked)isos.add(e.target.dataset.trajectoryCountry);else isos.delete(e.target.dataset.trajectoryCountry);updateTrajectory({countries:[...isos].slice(0,7).join('~')});}
 if(e.target.dataset.trajectorySelect)updateTrajectory({[e.target.dataset.trajectorySelect]:e.target.value});
});
document.addEventListener('change',e=>{const key=e.target.dataset.state;if(!key)return;if(key==='category'){update({indicator:Object.values(D.indicators).find(i=>i.group===e.target.value).id});return;}update({[key]:['year','start','lag'].includes(key)?+e.target.value:e.target.value});});
document.addEventListener('click',async e=>{
 const toggle=e.target.closest('[data-trajectory-key]');if(toggle){updateTrajectory({[toggle.dataset.trajectoryKey]:toggle.dataset.value});return;}
 const scale=e.target.closest('[data-chart-scale]');if(scale){update({scale:scale.dataset.chartScale});return;}
 if(e.target.closest('[data-close-picker]')){e.target.closest('details').open=false;return;}
 const n=e.target.closest('a[data-view],button[data-view],[data-indicator],[data-country],[data-iso],[data-year],[data-action],[data-benchmark]');if(!n)return;e.preventDefault();
 if(n.dataset.benchmark){const keys=new Set(S.benchmarks.split('~').filter(Boolean));if(keys.has(n.dataset.benchmark))keys.delete(n.dataset.benchmark);else keys.add(n.dataset.benchmark);update({benchmarks:[...keys].join('~')});}
 else if(n.dataset.view)update({view:n.dataset.view});
 else if(n.dataset.indicator)update({indicator:n.dataset.indicator,view:'trends'});
 else if(n.dataset.country||n.dataset.iso)update({iso:n.dataset.country||n.dataset.iso});
 else if(n.dataset.year)update({year:+n.dataset.year});
 else if(n.dataset.action==='download')download();
 else if(n.dataset.action==='trajectory-download')download(true);
 else if(n.dataset.action==='print')window.print();
 else if(n.dataset.action==='share'){try{await navigator.clipboard.writeText(location.href);$('notification').textContent='Link copied with your country, indicators and years.';}catch{$('notification').textContent='Share this URL: '+location.href;}}
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&e.target.closest('.country-picker')){const picker=e.target.closest('.country-picker');picker.open=false;picker.querySelector('summary').focus();return;}if(e.target.dataset.iso&&['Enter',' '].includes(e.key)){e.preventDefault();update({iso:e.target.dataset.iso});}});
window.addEventListener('popstate',()=>{S=readState();render();});
let resize;window.addEventListener('resize',()=>{clearTimeout(resize);resize=setTimeout(renderCharts,120);});
window.addEventListener('beforeprint',renderCharts);window.addEventListener('afterprint',renderCharts);
async function get(url){const r=await fetch(url,{cache:'no-cache'});if(!r.ok)throw new Error('Data request failed: HTTP '+r.status);return r.json();}
try{
 [D,C,F,M,K]=await Promise.all([get('data/outcomes.json'),get('../health-financing/data/core.json'),get('../health-financing/data/detail.json'),get('../health-financing/data/meta.json'),get('data/capital.json')]);
 S=readState();history.replaceState({},'',urlFor());$('scope').textContent=`195-country universe · ${Object.keys(D.indicators).length} indicators · Health series: 1990–2024, where available · MDGs & SDGs`;
 render();
}catch(error){$('content').innerHTML='<div class="empty error" role="alert"><h2>The data could not be loaded</h2><p>Please reload the page. The source data download remains available below.</p><a href="data/outcomes.csv">Download outcome data</a></div>';$('content').setAttribute('aria-busy','false');console.error(error);}
