import {readFileSync,existsSync} from 'node:fs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';
const preview=new URL('./preview/',import.meta.url);
const base=existsSync(preview)?preview:new URL('../../site/tools/health-outcomes/',import.meta.url);
const code=readFileSync(new URL('analytics.js',base),'utf8');
const A=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const d=JSON.parse(readFileSync(new URL('data/outcomes.json',base),'utf8'));
const root=new URL('../../site/tools/health-financing/data/',import.meta.url);
const core=JSON.parse(readFileSync(new URL('core.json',root),'utf8'));
const detail=JSON.parse(readFileSync(new URL('detail.json',root),'utf8'));
const capital=JSON.parse(readFileSync(new URL('data/capital.json',base),'utf8'));
test('All 23 outcome selectors retain exact-year source values on the X axis',()=>{
 for(const key of Object.keys(d.indicators)){
  const s=A.countryTrajectories(d,core,detail,capital,['IDN'],'u5','gghed_gdp',2003,2023)[0];
  const changed=A.countryTrajectories(d,core,detail,capital,['IDN'],key,'gghed_gdp',2003,2023)[0];
  for(const [j,p] of changed.points.entries()){assert.equal(p.x,A.at(d,'IDN',key,p.year));assert.equal(p.y,s.points[j].y);}
 }
});
test('Annual nominal and real prices use distinct source series for both spending components',()=>{
 for(const price of ['nominal','real']){
  const s=A.countryTrajectories(d,core,detail,capital,['IDN'],'u5','gghed_gdp',2003,2023,{component:'total',price})[0];
  const expected=price==='nominal'?25.51065636+5.02521214538846:51.286277637821804+10.1026183930959;
  assert.ok(Math.abs(s.points[0].y-expected)<1e-9);assert.equal(s.points[0].x,44.6);
  assert.equal(s.points.at(-1).y,null); // Missing 2023 capital remains missing in either basis.
 }
 const current=A.countryTrajectories(d,core,detail,capital,['IDN'],'u5','gghed_gdp',2003,2023,{component:'current',price:'nominal'})[0];
 assert.ok(Math.abs(current.points[0].y-25.51065636)<1e-9);
 const hk=A.countryTrajectories(d,core,detail,capital,['IDN'],'u5','gghed_gdp',2003,2023,{component:'capital',price:'nominal'})[0];
 assert.ok(Math.abs(hk.points[0].y-5.02521214538846)<1e-9);
});
test('Rebasing does not change the chosen price basis and cumulative nominal is rejected',()=>{
 const n=A.countryTrajectories(d,core,detail,capital,['IDN'],'uhc','gghed_gdp',2003,2023,{component:'current',price:'nominal',scale:'index'})[0];
 assert.equal(n.points[0].y,100);assert.equal(n.points[0].x,100);
 assert.equal(n.points.at(-1).financing,A.financeAt(core,detail,'IDN','che_pc_usd',2023));
 assert.throws(()=>A.countryTrajectories(d,core,detail,capital,['IDN'],'u5','gghed_gdp',2003,2023,{mode:'cumulative',component:'current',price:'nominal'}));
});
test('Trajectory has outcome on X, financing on Y, exact five-year dots and no duplicates',()=>{
 const s=A.countryTrajectories(d,core,detail,capital,['IDN','IDN','THA'],'u5','gghed_gdp',2003,2023);
 assert.equal(s.length,2);assert.deepEqual(s[0].points.map(p=>p.year),[2003,2008,2013,2018,2023]);
 assert.equal(s[0].points.at(-1).x,18.4);assert.equal(s[0].points.at(-1).y,A.financeAt(core,detail,'IDN','gghed_gdp',2023));
 assert.equal(A.countryTrajectories(d,core,detail,capital,['IDN'],'u5','gghed_gdp',2003,2021)[0].points.at(-1).year,2018);
});
test('Both trajectory indices use that country exact baseline',()=>{
 const s=A.countryTrajectories(d,core,detail,capital,['IDN','THA'],'u5','gghed_gdp',2003,2023,{scale:'index'});
 for(const c of s){assert.equal(c.points[0].x,100);assert.equal(c.points[0].y,100);}
 assert.ok(Math.abs(s[0].points.at(-1).x-100*18.4/44.6)<1e-10);
});
test('Cumulative spending sums all annual real per-capita flows, not five-year points or shares',()=>{
 const s=A.countryTrajectories(d,core,detail,capital,['IDN'],'u5','gghed_gdp',2003,2023,{mode:'cumulative',component:'current'})[0];
 const expected=Array.from({length:21},(_,j)=>A.financeAt(core,detail,'IDN','che_usd2023_pc',2003+j)).reduce((a,b)=>a+b,0);
 assert.equal(s.points.at(-1).financing,expected);assert.equal(s.points.at(-1).observedYears,21);
 assert.throws(()=>A.countryTrajectories(d,core,detail,capital,['IDN'],'u5','gghed_gdp',2003,2023,{mode:'cumulative'}));
});
test('Capital is additional to current expenditure; missing capital never becomes zero',()=>{
 const s=A.countryTrajectories(d,core,detail,capital,['PHL','IDN'],'u5','gghed_gdp',2003,2023,{mode:'cumulative',component:'total'});
 const expected=Array.from({length:21},(_,j)=>A.financeAt(core,detail,'PHL','che_usd2023_pc',2003+j)+A.at(capital,'PHL','hk_usd2023_pc',2003+j)).reduce((a,b)=>a+b,0);
 assert.equal(s[0].points.at(-1).financing,expected);
 assert.equal(s[1].points.at(-1).financing,null);assert.equal(s[1].points.at(-1).observedYears,17);
 assert.ok(s[1].points.find(p=>p.year===2018).financing>0);
});
test('An interior spending gap blocks every later cumulative total even if observations resume',()=>{
 const s=A.countryTrajectories(d,core,detail,capital,['VNM'],'u5','gghed_gdp',2018,2023,{mode:'cumulative',component:'capital'})[0];
 assert.equal(s.annual.find(p=>p.year===2019).financing,null);
 assert.ok(s.annual.find(p=>p.year===2020).investment>0);
 assert.equal(s.annual.find(p=>p.year===2020).financing,null);
});
test('Missing outcome pairs and missing baseline stay missing when indexing',()=>{
 const s=A.countryTrajectories(d,core,detail,capital,['SGP'],'fp','gghed_gdp',2003,2023,{scale:'index'})[0];
 assert.ok(s.points.every(p=>p.x===null));
 const z=structuredClone(d);z.countries.IDN.series.u5['2003']=0;
 assert.ok(A.countryTrajectories(z,core,detail,capital,['IDN'],'u5','gghed_gdp',2003,2023,{scale:'index'})[0].points.every(p=>p.x===null));
});
test('Exact years never borrow a previous observation and zero stays zero',()=>{
 const toy={countries:{X:{series:{i:{2000:0,2002:4}}}}};
 assert.equal(A.at(toy,'X','i',2000),0);assert.equal(A.at(toy,'X','i',2001),null);
 assert.deepEqual(A.latest(toy,'X','i',2001),{year:2000,value:0});
 assert.equal(A.change(0,4).relative,null);
});
test('Financing lag pairs the declared years and excludes incomplete pairs',()=>{
 const isos=['IDN','THA','SGP'];const p=A.pairs(d,core,detail,isos,'uhc','gghed_gdp',2023,5);
 assert.equal(p.length,3);for(const r of p){assert.equal(r.x,core.countries[r.iso].series.gghed_gdp[18]);assert.equal(r.y,d.countries[r.iso].series.uhc['2023']);assert.equal(r.financeYear,2018);}
 assert.equal(A.pairs(d,core,detail,isos,'uhc','gghed_gdp',1990,0).length,0);
});
test('MDG child mortality is two-thirds reduction, not 66.7 points',()=>{
 const a=A.assess(d,'IDN','u5','mdg',2023);assert.equal(a.target,d.countries.IDN.series.u5['1990']/3);assert.equal(a.point.year,2015);
});
test('Missing MDG baseline cannot produce a success label',()=>{
 const toy=structuredClone(d);delete toy.countries.IDN.series.u5['1990'];assert.equal(A.assess(toy,'IDN','u5','mdg',2023).kind,'missing');
});
test('Global maternal mortality benchmark is not country achievement',()=>{assert.equal(A.assess(d,'SGP','maternal','sdg',2023).kind,'reference');});
test('SDG uses actual latest year; never claims a 2023 observation for NCD',()=>{
 const r=A.assess(d,'IDN','ncd','sdg',2023);assert.equal(r.point.year,2021);assert.ok(Math.abs(r.target-d.countries.IDN.series.ncd['2015']*2/3)<1e-10);
 assert.equal(A.assess(d,'IDN','ncd','sdg',2010).kind,'missing');
});
test('Revised UHC and hardship source values agree with WHO extracts',()=>{
 assert.equal(A.at(d,'IDN','uhc',2023),67);
 assert.equal(A.at(d,'IDN','hardship',2023),26.566240311);
 assert.equal(d.indicators.hardship.code,'FINANCIALHARDSHIP_PROPORTIONOFPOP');
});
test('All displayed source points are finite, nonnegative and in the declared country universe',()=>{
 assert.equal(Object.keys(d.countries).length,195);assert.equal(Object.keys(d.indicators).length,23);
 let n=0;for(const [iso,c] of Object.entries(d.countries)){assert.ok(core.countries[iso]);for(const [key,series] of Object.entries(c.series)){for(const [year,v] of Object.entries(series)){assert.ok(A.finite(v)&&v>=0,[iso,key,year]);assert.ok(+year>=1990&&+year<=2024);if(d.indicators[key].unit.includes('%')||key==='uhc')assert.ok(v<=100,[iso,key,year,v]);n++;}}}
 assert.equal(n,Object.values(d.indicators).reduce((s,i)=>s+i.n_observations,0));
});
test('Peer medians are unweighted and preserve zero',()=>{assert.equal(A.median([0,10,null]),5);assert.equal(A.median([]),null);assert.equal(A.peerIsos(d,'IDN','asean').length,11);});
test('CSV preserves missing values and quotes source definitions',()=>{assert.equal(A.csv([['a,b','say "yes"',null,0]]),'"a,b","say ""yes""","","0"');});
const toy={countries:{A:{income_group:'high',wb_region:'East',series:{i:{2000:10,2001:5,2002:4}}},B:{income_group:'high',wb_region:'East',series:{i:{2000:20,2001:15,2002:10}}},C:{income_group:'low',wb_region:'West',series:{i:{2000:100,2002:50}}}},peer_presets:{asean:{members:['A','B']}}};
const toyRead=(iso,y)=>A.at(toy,iso,'i',y);
test('Balanced global benchmark excludes focus and fixes membership across all years',()=>{
 const r=A.benchmarkTrend(toy,'A','world',2000,2002,toyRead);
 assert.deepEqual(r.members,['B']);assert.equal(r.eligible,2);assert.deepEqual(r.points.map(p=>p.raw),[20,15,10]);assert.deepEqual(r.points.map(p=>p.n),[1,1,1]);
});
test('Available-year benchmark exposes changing denominators, never imputes',()=>{
 const r=A.benchmarkTrend(toy,'A','world',2000,2002,toyRead,{cohort:'available'});
 assert.deepEqual(r.points.map(p=>p.n),[2,1,2]);assert.deepEqual(r.points.map(p=>p.raw),[60,15,30]);
});
test('Baseline index divides by each series own baseline; change uses subtraction',()=>{
 const r=A.benchmarkTrend(toy,'A','world',2000,2002,toyRead,{scale:'index'});
 assert.deepEqual(r.points.map(p=>p.y),[100,75,50]);
 const c=A.benchmarkTrend(toy,'A','country',2000,2002,toyRead,{scale:'change'});
 assert.deepEqual(c.points.map(p=>p.y),[0,-5,-6]);
});
test('A zero or missing baseline cannot generate an index or an invented observation',()=>{
 const zero=(iso,y)=>y===2000?0:2;
 const z=A.benchmarkTrend(toy,'A','country',2000,2002,zero,{scale:'index'});assert.ok(z.points.every(p=>p.y===null));
 const sparse=A.benchmarkTrend(toy,'C','country',2000,2002,toyRead);assert.equal(sparse.points[1].y,null);
});
test('Region and income comparators follow the selected country rather than a fixed region',()=>{
 const east=A.benchmarkTrend(toy,'A','region',2000,2002,toyRead);assert.deepEqual(east.members,['B']);
 const west=A.benchmarkTrend(toy,'C','region',2000,2002,toyRead);assert.equal(west.eligible,0);assert.ok(west.points.every(p=>p.y===null));
 const income=A.benchmarkTrend(toy,'A','income',2000,2002,toyRead);assert.deepEqual(income.members,['B']);
});
test('Real regional and global trend values match independently selected peers',()=>{
 const read=(iso,y)=>A.at(d,iso,'u5',y),r=A.benchmarkTrend(d,'IDN','region',2003,2023,read);
 const members=Object.keys(d.countries).filter(k=>k!=='IDN'&&d.countries[k].wb_region===d.countries.IDN.wb_region&&Array.from({length:21},(_,j)=>2003+j).every(y=>A.finite(read(k,y))));
 assert.deepEqual(r.members,members);assert.equal(r.points.at(-1).raw,A.median(members.map(k=>read(k,2023))));
 assert.ok(r.points.every(p=>p.n===members.length));
});
