// Descriptive comparisons only. All reads require the stated year; no imputation.
export const finite = v => typeof v === 'number' && Number.isFinite(v);
export function at(data,iso,key,year){const v=data.countries[iso]?.series[key]?.[String(year)];return finite(v)?v:null;}
export function financeAt(core,detail,iso,key,year){const v=(core.countries[iso]?.series[key]||detail.countries[iso]?.series[key])?.[year-core.year_min];return finite(v)?v:null;}
export function observed(data,iso,key,until=2025){return Object.entries(data.countries[iso]?.series[key]||{}).map(([year,value])=>({year:+year,value})).filter(p=>p.year<=until&&finite(p.value)).sort((a,b)=>a.year-b.year);}
export function latest(data,iso,key,until){return observed(data,iso,key,until).at(-1)||null;}
export function median(values){const a=values.filter(finite).sort((x,y)=>x-y);return a.length?(a[Math.floor((a.length-1)/2)]+a[Math.ceil((a.length-1)/2)])/2:null;}
export function peerIsos(data,iso,group){const focus=data.countries[iso];return Object.keys(data.countries).filter(k=>group==='world'||(group==='asean'?data.peer_presets.asean.members.includes(k):group==='income'?data.countries[k].income_group===focus.income_group:data.countries[k].wb_region===focus.wb_region));}
export function pairs(data,core,detail,isos,key,finance,year,lag=0){return isos.map(iso=>({iso,name:data.countries[iso].name,y:at(data,iso,key,year),x:financeAt(core,detail,iso,finance,year-lag),year,financeYear:year-lag})).filter(p=>finite(p.x)&&finite(p.y));}
export function change(a,b){return finite(a)&&finite(b)?{absolute:b-a,relative:a===0?null:100*(b/a-1)}:null;}
// Exact five-year pairs. Cumulative spending sums EVERY annual observation,
// including the baseline year; it never sums percentages or skips missing years.
export function countryTrajectories(data,core,detail,capital,isos,key,finance,start,end,{scale='level',mode='annual',component='selected',price='real'}={}){
 if(mode==='cumulative'&&component==='selected')throw new Error('Cumulative spending requires a constant-dollar expenditure series.');
 if(mode==='cumulative'&&price!=='real')throw new Error('Cumulative spending requires real prices.');
 const currentCode=price==='nominal'?'che_pc_usd':'che_usd2023_pc',capitalCode=price==='nominal'?'hk_usd_pc':'hk_usd2023_pc';
 const years=Array.from({length:Math.max(0,end-start+1)},(_,j)=>start+j);
 const colors=['#12608f','#b04b00','#00786c','#8153a0','#ad365d','#5d6b2d','#8b602c','#526579'];
 return [...new Set(isos)].filter(iso=>data.countries[iso]).slice(0,8).map((iso,j)=>{
  let sum=0,complete=true,observedYears=0;
  const annual=years.map(year=>{
   const outcome=at(data,iso,key,year),current=financeAt(core,detail,iso,currentCode,year),investment=at(capital,iso,capitalCode,year);
   const expenditure=component==='selected'?financeAt(core,detail,iso,finance,year):component==='current'?current:component==='capital'?investment:finite(current)&&finite(investment)?current+investment:null;
   if(finite(expenditure)){sum+=expenditure;observedYears++;}else complete=false;
   return{year,outcome,current,investment,expenditure,financing:mode==='cumulative'?(complete?sum:null):expenditure,observedYears,expectedYears:year-start+1,sampled:(year-start)%5===0};
  });
  const baseline=annual[0]||{},index=(v,b)=>finite(v)&&finite(b)&&b!==0?(v/b)*100:null;
  for(const p of annual){p.x=scale==='index'?index(p.outcome,baseline.outcome):p.outcome;p.y=scale==='index'?index(p.financing,baseline.financing):p.financing;}
  return{iso,name:data.countries[iso].name,color:colors[j],baselineOutcome:baseline.outcome??null,baselineFinance:baseline.financing??null,points:annual.filter(p=>p.sampled),annual};
 });
}
// Fixed membership avoids mistaking changes in country composition for progress.
// Annual-available membership is an explicit alternative for sparse survey series.
export function benchmarkTrend(data,iso,group,start,end,read,{cohort='balanced',scale='level'}={}){
 const years=Array.from({length:Math.max(1,end-start+1)},(_,i)=>start+i);
 const peers=group==='country'?[iso]:peerIsos(data,iso,group).filter(k=>k!==iso);
 const members=group==='country'||cohort==='available'?peers:peers.filter(k=>years.every(y=>finite(read(k,y))));
 const values=years.map(year=>{const available=members.map(k=>read(k,year)).filter(finite);return{year,raw:group==='country'?read(iso,year):median(available),n:available.length};});
 const base=values[0]?.raw??null;
 return{group,eligible:peers.length,members,baseline:base,points:values.map(p=>({...p,x:p.year,y:scale==='index'?(finite(p.raw)&&finite(base)&&base!==0?100*p.raw/base:null):scale==='change'?(finite(p.raw)&&finite(base)?p.raw-base:null):p.raw}))};
}
export function assess(data,iso,key,framework,until){
 const target=data.targets[framework]?.[key];
 if(!target)return{status:'No numeric assessment',kind:'none',note:'Indicator tracked; no numeric country threshold is applied in this explorer.'};
 if(target.type==='reference')return{status:'Global benchmark',kind:'reference',target:target.value,note:'Below 70 is a global maternal mortality benchmark, not a country-specific pass/fail target.'};
 const base=target.type==='relative'?at(data,iso,key,target.baseline):null;
 const threshold=target.type==='relative'?(finite(base)?base*target.factor:null):target.value;
 const point=framework==='mdg'?{year:2015,value:at(data,iso,key,2015)}:latest(data,iso,key,until);
 if(!finite(threshold)||!finite(point?.value))return{status:'Not assessable',kind:'missing',target:threshold,note:`Exact ${target.baseline||'target'} baseline or ${framework==='mdg'?'2015 endpoint':'endpoint'} is not available.`};
 if(framework==='sdg'&&point.year<2015)return{status:'Not assessable',kind:'missing',target:threshold,note:'No SDG-era observation is available.'};
 const met=point.value<=threshold;
 const required=!met&&framework==='sdg'&&point.year<target.year&&point.value>0&&threshold>0?100*(1-Math.pow(threshold/point.value,1/(target.year-point.year))):null;
 return{status:met?(framework==='mdg'?'Threshold met in 2015':'Threshold met in '+point.year):(framework==='mdg'?'Threshold not met in 2015':'Above threshold in '+point.year),kind:met?'met':'gap',target:threshold,point,required,note:required==null?'Point estimates only; uncertainty is not assessed.':`${required.toFixed(1)}% annual reduction would be needed from ${point.year} to ${target.year}. This is an arithmetic requirement, not a forecast.`};
}
export function csv(rows){return rows.map(row=>row.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(',')).join('\r\n');}
