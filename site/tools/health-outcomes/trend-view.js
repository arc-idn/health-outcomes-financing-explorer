import {at,financeAt,finite,benchmarkTrend,change,assess} from './analytics.js?v=20261003d';

// Rendering reuses the existing application helpers; the comparison maths is pure.
export function trendView(ctx){
 const {D,C,F,M,S,esc,fmt,sign,select,actions,chart,source,finSource,table,trajectory}=ctx;
 const i=D.indicators[S.indicator],f=M.indicators[S.finance],c=D.countries[S.iso];
 const active=new Set(S.benchmarks.split('~'));
 const styles=[
  {group:'country',short:c.name,label:c.name,color:'#12608f',dash:''},
  {group:'region',short:'Regional median',label:c.wb_region,color:'#00786c',dash:'9 3'},
  {group:'income',short:'Income-group median',label:M.income_groups.labels[c.income_group]||c.income_group,color:'#b04b00',dash:'5 3 1 3'},
  {group:'world',short:'Global median',label:'Global country peers',color:'#526579',dash:'2 4'},
  {group:'asean',short:'ASEAN median',label:'ASEAN (11-country preset)',color:'#8153a0',dash:'13 4'}
 ];
 const selected=styles.filter(s=>s.group==='country'||active.has(s.group));
 const outcomeRead=(iso,year)=>at(D,iso,S.indicator,year);
 const financeRead=(iso,year)=>financeAt(C,F,iso,S.finance,year);
 const make=read=>selected.map(style=>({...benchmarkTrend(D,S.iso,style.group,S.start,S.year,read,{cohort:S.cohort,scale:S.scale}),...style}));
 const outcomes=make(outcomeRead),financing=make(financeRead),own=outcomes[0];
 const start=own.points[0].raw,end=own.points.at(-1).raw,delta=change(start,end);
 const unit=(raw)=>S.scale==='index'?`Index (${S.start} = 100)`:S.scale==='change'?`Change from ${S.start} (${raw.includes('%')?'percentage points':raw.toLowerCase()})`:raw;
 const scaleInfo=S.scale==='index'?`Each line is rebased to its own ${S.start} value of 100. A value of 80 means 20% below baseline, not an 80% service coverage rate.`:S.scale==='change'?`Each line shows its change from ${S.start}; zero marks no change. Changes in percentages are percentage points.`:`Values remain in their original units. Dashed lines are country medians; the solid blue line is ${c.name}.`;
 const cohortInfo=S.cohort==='balanced'?`Peer membership is fixed within each chart: only countries with data in every year from ${S.start} to ${S.year} enter its median.`:'Each year uses countries with data in that year. The sample can change; movements in a median may partly reflect a changing country mix.';
 const direction=i.direction==='lower'?'A downward outcome trend indicates improvement.':'An upward outcome trend indicates improvement.';
 const buttons=styles.slice(1).map(s=>`<button class="benchmark-toggle" type="button" data-benchmark="${s.group}" aria-pressed="${active.has(s.group)}"><svg width="30" height="12" viewBox="0 0 30 12" aria-hidden="true"><path d="M1 6H29" stroke="${s.color}" stroke-width="2.5" stroke-dasharray="${s.dash}"/></svg><span>${esc(s.short)}</span></button>`).join('');
 const controls=`<div class="inline-controls trend-controls">${select('start','Baseline year',Array.from({length:S.year-1990+1},(_,j)=>[1990+j,1990+j]))}<div class="toggle-field"><span class="control-label">Chart scale</span><div class="segmented" role="group" aria-label="Chart scale">${[['level','Actual values'],['index','Baseline = 100'],['change','Change']].map(([v,l])=>`<button data-chart-scale="${v}" aria-pressed="${S.scale===v}">${l}</button>`).join('')}</div></div>${select('cohort','Countries in each benchmark',[['balanced','Same countries throughout'],['available','Available countries each year']])}${select('finance','Financing measure',['gghed_gdp','gghed_gge','gghed_che','oops_che','che_gdp','che_ppp_pc','gghed_ppp_pc','che_usd2023_pc','che_pc_usd'].map(k=>[k,M.indicators[k].short_label+' ('+M.indicators[k].unit+')']))}</div>`;
 const definition=`<p class="benchmark-definitions"><strong>Regional:</strong> ${esc(c.wb_region)}. <strong>Economic peers:</strong> ${esc(M.income_groups.labels[c.income_group]||c.income_group)}, fixed 2023 income classification. <strong>Global:</strong> countries in the 195-country panel. All peer medians exclude ${esc(c.name)} and give each country equal weight; they are not population-weighted regional or world estimates.</p>`;
 const narrative=delta?`${esc(c.name)}: <strong>${fmt(start)}</strong> in ${S.start} → <strong>${fmt(end)}</strong> in ${S.year}${finite(delta.relative)?` (${sign(delta.relative)}%)`:''}. ${direction}`:`An exact ${S.start}–${S.year} comparison is not available for ${esc(c.name)}. Its observed years remain visible; choose another baseline or end year where needed.`;
 const benchmarkConfig=(series,rawUnit,aria)=>{
  const target=series===outcomes?assess(D,S.iso,S.indicator,'sdg',S.year):null;
  const reference=S.scale==='index'?100:S.scale==='change'?0:target?.target??null;
  return{series,scale:S.scale,start:S.start,end:S.year,unit:unit(rawUnit),aria,fmt,esc,reference,referenceLabel:S.scale==='index'?`${S.start} = 100`:S.scale==='change'?'Baseline: no change':S.indicator==='maternal'?'Global 2030 benchmark':S.indicator==='ncd'?'Country 2030 threshold':'2030 threshold'};
 };
 function legends(series){return `<div class="trend-legend">${series.map(s=>`<span><svg width="31" height="12" viewBox="0 0 31 12" aria-hidden="true"><path d="M1 6H30" stroke="${s.color}" stroke-width="${s.group==='country'?3:2.3}" stroke-dasharray="${s.dash}"/></svg><span>${esc(s.short)}${s.group==='country'?'':` <small>(${s.points.at(-1).n}/${s.eligible} peers in ${S.year})</small>`}</span></span>`).join('')}</div>`;}
 function unavailable(series){const excluded=series.filter(s=>!s.points.some(p=>finite(p.y)));return excluded.length?`<p class="trend-missing">No plotted line: ${excluded.map(s=>esc(s.short)).join(', ')}. ${S.scale==='index'?'Index values require a non-zero baseline. ':''}${S.cohort==='balanced'?'For sparse data, try another baseline or “Available countries each year”.':'Source observations or baseline values are missing.'}</p>`:'';}
 const baselineTable=(series,rawUnit)=>table(['Country / benchmark',`Baseline<br>${S.start}`,`Endpoint<br>${S.year}`,'Change','Relative change',`Country gap<br>${S.start}`,`Country gap<br>${S.year}`],series.map(s=>{
  const first=s.points[0],last=s.points.at(-1),diff=change(first.raw,last.raw),gap0=finite(start)&&finite(first.raw)?start-first.raw:null,gap1=finite(end)&&finite(last.raw)?end-last.raw:null;
  return `<tr class="${s.group==='country'?'selected':''}"><td>${esc(s.short)}<span class="small">${s.group==='country'?'Selected country':esc(s.label)}</span></td><td class="num">${fmt(first.raw)}<span class="small">${s.group==='country'?'':first.n+'/'+s.eligible+' peers'}</span></td><td class="num">${fmt(last.raw)}<span class="small">${s.group==='country'?'':last.n+'/'+s.eligible+' peers'}</span></td><td class="num">${sign(diff?.absolute)}</td><td class="num">${finite(diff?.relative)?sign(diff.relative)+'%':'Not available'}</td><td class="num">${s.group==='country'?'Not applicable':sign(gap0)}</td><td class="num">${s.group==='country'?'Not applicable':sign(gap1)}</td></tr>`;
 }),`Original units: ${esc(rawUnit)}. Country gap = selected country minus benchmark; changes in percentages use percentage points.`);
 // A long-format export carries every rendered comparison and its denominator.
 const rows=[['focus_iso3','focus_country','measure','source_code','unit','benchmark','benchmark_definition','cohort_rule','baseline_year','year','source_value','plotted_value','chart_scale','observed_countries','eligible_countries','baseline_value','source_url']];
 for(const [measure,series,code,rawUnit,url] of [['outcome',outcomes,i.code,i.unit,i.url],['financing',financing,S.finance,f.unit,'https://apps.who.int/nha/database']])for(const s of series)for(const p of s.points)rows.push([S.iso,c.name,measure,code,rawUnit,s.group,s.label,S.cohort,S.start,p.year,p.raw,p.y,S.scale,p.n,s.eligible,s.baseline,url]);
 const annualRows=Array.from({length:S.year-S.start+1},(_,j)=>S.year-j).map(y=>`<tr><td>${y}</td>${outcomes.map(s=>{const p=s.points.find(p=>p.year===y);return `<td class="num">${fmt(p.raw)}${s.group==='country'?'':`<span class="small">n=${p.n}</span>`}</td>`;}).join('')}</tr>`);
 const html=`<div class="trend-intro"><p>Trends against regional, economic and global peers · Baseline: <strong>${S.start}</strong></p>${actions()}</div>`+controls+
 `<div class="benchmark-toolbar"><span class="small">Show peer lines</span>${buttons}</div>`+
 `<section class="panel trend-panel"><div class="trend-heading"><div><h2>${esc(c.name)}: ${esc(i.label)}</h2><p>${esc(unit(i.unit))} · ${S.start}–${S.year}</p></div><span class="badge">${esc(i.sdg)}</span></div>${legends(outcomes)}${chart('trend-outcome',benchmarkConfig(outcomes,i.unit,`${i.label}: ${c.name} and peer benchmarks, ${S.start} to ${S.year}`))}${unavailable(outcomes)}<p class="trend-takeaway">${narrative}</p>${source()}</section>`+
 `<div class="trend-method"><p>${esc(scaleInfo)} ${esc(direction)}</p><p>${esc(cohortInfo)} Missing years break lines. The readout shows the number of contributing countries.</p></div>`+
 `<section class="panel trend-panel"><div class="trend-heading"><div><h3>${esc(f.short_label)}</h3><p>${esc(unit(f.unit))} · ${S.start}–${S.year}</p></div><span class="badge">Financing trajectory</span></div>${legends(financing)}${chart('trend-finance',benchmarkConfig(financing,f.unit,`${f.short_label}: ${c.name} and peer benchmarks, ${S.start} to ${S.year}`))}${unavailable(financing)}${finSource()}</section>`+
 trajectory().html+
 `<section class="benchmark-summary"><h3>Did the country close the gap?</h3><p>${esc(i.label)} in original units. ${i.direction==='lower'?'A negative gap means the country is below the peer median for this adverse outcome.':'A positive gap means the country is above the peer median for this coverage or health measure.'} Changes in a peer gap compare exact endpoints.</p>${baselineTable(outcomes,i.unit)}</section>`+
 definition+
 `<details class="annual-detail"><summary>Annual outcome values and peer sample sizes</summary>${table(['Year',...outcomes.map(s=>esc(s.short))],annualRows,`Original units: ${esc(i.unit)}. Exact years only.`)}</details>`+
 `<section class="panel"><h3>What this comparison can tell us</h3><p>${esc(i.note)}</p><p>Financing and outcomes are shown on separate scales. A faster change or a narrower peer gap does not by itself identify a causal financing effect. The outcome and financing charts can use different eligible samples because data availability differs.</p><p class="small">${esc(f.subtitle)} ${S.finance.includes('ppp')?'Current international dollars compare purchasing power across countries; they do not adjust for inflation over time.':S.finance==='che_pc_usd'?'Current US dollars also reflect prices and exchange rates.':''}</p><a class="button" href="?${new URLSearchParams({...S,view:'compare'})}" data-view="compare">Compare individual countries</a></section>`;
 return{html,rows};
}
