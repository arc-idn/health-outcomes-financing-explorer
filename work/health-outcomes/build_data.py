#!/usr/bin/env python3
"""Fetch and freeze official observations, then rebuild the outcomes module offline.

Run from any directory: python3 work/health-outcomes/build_data.py [--refresh]
No interpolation, country aggregates, or cross-vintage UHC joins are performed.
The financing panel remains the existing financing tool's canonical payload.
"""
import argparse
import concurrent.futures
import csv
import datetime
import gzip
import hashlib
import io
import json
from pathlib import Path
import re
import time
import requests

ROOT = Path(__file__).resolve().parents[2]
WORK = Path(__file__).resolve().parent
SOURCE = WORK / 'source'
OUT = (WORK / 'preview' if (WORK / 'preview').exists() else ROOT / 'site/tools/health-outcomes') / 'data'
UN3 = 'https://sdgs.un.org/goals/goal3'
UNMDG = 'https://unstats.un.org/unsd/mdg/Host.aspx?Content=Indicators/OfficialList.htm'
WHO_UHC = 'https://www.who.int/data/uhc-2025-technical-appendices-and-regional-data-tables'

# Each mapping states whether a series is the indicator, a component, or context.
SPECS = [
 ('u5','SH.DYN.MORT','Under-five mortality','Health outcomes','Deaths per 1,000 live births','lower','SDG 3.2.1','MDG 4.1','Probability of death before age five, expressed per 1,000 live births. Modelled estimates; uncertainty intervals are not included in this extract.'),
 ('neonatal','SH.DYN.NMRT','Neonatal mortality','Health outcomes','Deaths per 1,000 live births','lower','SDG 3.2.2','Related to MDG 4','Death during the first 28 days of life, per 1,000 live births. Modelled estimates; this is distinct from infant mortality.'),
 ('infant','SP.DYN.IMRT.IN','Infant mortality','Health outcomes','Deaths per 1,000 live births','lower','Related to SDG 3.2','MDG 4.2','Death before the first birthday, per 1,000 live births. The under-five and neonatal SDG thresholds are not applied to this series.'),
 ('maternal','SH.STA.MMRT','Maternal mortality','Health outcomes','Deaths per 100,000 live births','lower','SDG 3.1.1','MDG 5.1','Maternal deaths during pregnancy or within 42 days of termination, per 100,000 live births. Modelled estimates; uncertainty intervals are not included. The global SDG benchmark is not a country-specific pass/fail target.'),
 ('life','SP.DYN.LE00.IN','Life expectancy at birth','Health outcomes','Years','higher','Health-system context','No direct MDG indicator','Expected years of life under the mortality rates of the stated year. This is a population outcome, not the observed lifespan of a birth cohort.'),
 ('ncd','SH.DYN.NCOM.ZS','Premature NCD mortality','Health outcomes','Probability (%)','lower','SDG 3.4.1','No direct MDG indicator','Probability of dying between exact ages 30 and 70 from cardiovascular disease, cancer, diabetes or chronic respiratory disease. This is not the share of all deaths due to NCDs.'),
 ('tb','SH.TBS.INCD','Tuberculosis incidence','Health outcomes','Cases per 100,000 population','lower','SDG 3.3.2','MDG 6.9 component','Estimated new and relapse tuberculosis cases in a year per 100,000 population. Case notifications and case detection are different measures.'),
 ('hiv','SH.HIV.INCD.ZS','HIV incidence, ages 15–49','Health outcomes','New infections per 1,000 uninfected people','lower','SDG 3.3.1: ages 15–49 subset','Related to MDG 6','New HIV infections per 1,000 uninfected people aged 15–49. This subset is not the full all-age SDG series or the historical MDG prevalence indicator.'),
 ('malaria','SH.MLR.INCD.P3','Malaria incidence','Health outcomes','Cases per 1,000 population at risk','lower','SDG 3.3.3','MDG 6.6 component','Estimated cases per 1,000 people at risk of malaria. A missing country value does not mean zero cases or elimination.'),
 ('stunting','SH.STA.STNT.ZS','Child stunting','Nutrition & living conditions','% of children under five','lower','SDG 2.2.1','Related to MDG 1','Height-for-age more than two standard deviations below the child growth reference. Survey years are sparse; stunting is not underweight.'),
 ('underweight','SH.STA.MALN.ZS','Child underweight','Nutrition & living conditions','% of children under five','lower','Related to SDG 2.2','MDG 1.8','Weight-for-age more than two standard deviations below the child growth reference. No substitution of stunting or wasting for underweight.'),
 ('births','SH.STA.BRTC.ZS','Skilled attendance at birth','Service coverage','% of births','higher','SDG 3.1.2','MDG 5.2','Births attended by trained health personnel. Attendance measures contact with services, not quality or effective coverage.'),
 ('dtp','SH.IMM.IDPT','DTP3 immunization','Service coverage','% of children aged 12–23 months','higher','SDG 3.b.1 component','Related to MDG 4','Children receiving three doses of diphtheria, tetanus and pertussis vaccine. One vaccine tracer does not represent coverage of all nationally recommended vaccines.'),
 ('measles','SH.IMM.MEAS','Measles immunization','Service coverage','% of children aged 12–23 months','higher','Related to SDG 3.b.1','MDG 4.3','Children receiving at least one dose of measles-containing vaccine. This is not the second-dose measles tracer used in SDG vaccine reporting.'),
 ('anc','SH.STA.ANVC.ZS','Antenatal care, at least one visit','Service coverage','% of pregnant women','higher','Related to SDG 3.1','MDG 5.5: one-visit component','At least one pregnancy-related contact with skilled health personnel. This series does not measure four visits, eight contacts or quality of care.'),
 ('fp','SH.FPL.SATM.ZS','Family planning needs met','Service coverage','% of married women with demand','higher','SDG 3.7.1: married-women subset','Related to MDG 5.B','Demand satisfied with modern methods among married women aged 15–49. The denominator is narrower than the all-women SDG indicator.'),
 ('tb_success','SH.TBS.CURE.ZS','TB treatment success','Service coverage','% of registered new cases','higher','Related to SDG 3.3','MDG 6.10 component','Success among registered new TB cases, or new and relapse cases in some countries. Cohort definitions can vary; people not diagnosed or registered are excluded.'),
 ('art','SH.HIV.ARTC.ZS','HIV treatment coverage','Service coverage','% of people living with HIV','higher','Related to SDG 3.3','Related to MDG 6.5','People living with HIV receiving antiretroviral therapy. The historical MDG denominator was people with advanced HIV infection; the two measures are not interchangeable.'),
 ('water','SH.H2O.SMDW.ZS','Safely managed drinking water','Nutrition & living conditions','% of population','higher','SDG 6.1.1','Related to MDG 7.8; definition changed','Water from an improved source that is accessible on premises, available when needed and free from contamination. This is stricter than the MDG improved-source definition.'),
 ('sanitation','SH.STA.SMSS.ZS','Safely managed sanitation','Nutrition & living conditions','% of population','higher','SDG 6.2.1: sanitation component','Related to MDG 7.9; definition changed','Improved, non-shared sanitation with excreta safely disposed of or treated. Handwashing is a separate component of SDG 6.2.1; this is stricter than the MDG improved-sanitation definition.'),
 ('adolescent','SP.ADO.TFRT','Adolescent birth rate, ages 15–19','Health outcomes','Births per 1,000 women aged 15–19','lower','SDG 3.7.2: ages 15–19 subset','MDG 5.4','Live births per 1,000 women aged 15–19. The additional SDG age group 10–14 is not covered by this series.'),
]

def read_json(path):
    return json.loads(path.read_text())

def fetch(url):
    for attempt in range(3):
        try:
            r=requests.get(url, timeout=90)
            r.raise_for_status()
            return r
        except requests.RequestException:
            if attempt==2: raise
            time.sleep(attempt+1)

def wb(spec, refresh=False):
    key, code, label, group, unit, direction, sdg, mdg, note = spec
    fp=SOURCE / (code+'.json.gz')
    url=f'https://api.worldbank.org/v2/country/all/indicator/{code}?source=2&format=json&date=1990:2025&per_page=20000'
    if refresh or not fp.exists():
        body=fetch(url).content
        raw=json.loads(body)
        assert len(raw)==2 and raw[0]['pages']==1, (code,raw[0])
        fp.write_bytes(gzip.compress(body,mtime=0))
        meta=fetch(f'https://api.worldbank.org/v2/indicator/{code}?source=2&format=json').json()
        (SOURCE/(code+'.metadata.json')).write_text(json.dumps(meta,indent=2)+'\n')
    raw=json.loads(gzip.decompress(fp.read_bytes()))
    md=read_json(SOURCE/(code+'.metadata.json'))[1][0]
    assert raw[1] and md['id']==code, code
    indicator=dict(id=key,code=code,label=label,group=group,unit=unit,direction=direction,sdg=sdg,mdg=mdg,note=note,
                   source='World Bank WDI',producer=md['sourceOrganization'],url='https://data.worldbank.org/indicator/'+code,
                   api_url=url,last_updated=raw[0]['lastupdated'],sha256=hashlib.sha256(fp.read_bytes()).hexdigest())
    points=[]
    for r in raw[1]:
        if r['countryiso3code'] in COUNTRIES and r['value'] is not None:
            points.append((r['countryiso3code'],int(r['date']),r['value']))
    print(f'{key}: {len(points)} observations',flush=True)
    return indicator,points

def who(ind,refresh=False):
    dimension = 'null' if ind['id']=='uhc' else "'FINANCIALHARDSHIPCOMPONENT_COMPONENT_TOTAL'"
    url=f"https://ghoapi.azureedge.net/api/{ind['code']}?$filter=SpatialDimType eq 'COUNTRY' and Dim1 eq {dimension} and Dim2 eq null"
    fp=SOURCE/(ind['code']+'-countries.json.gz')
    if refresh or not fp.exists(): fp.write_bytes(gzip.compress(fetch(url).content,mtime=0))
    raw=json.loads(gzip.decompress(fp.read_bytes()))
    assert not raw.get('@odata.nextLink'), 'WHO pagination must be handled before using this extract'
    rows=raw['value'];points=[]
    for row in rows:
        if row['SpatialDim'] in COUNTRIES and 1990<=row['TimeDim']<=2025:
            if not re.fullmatch(r'\d+(?:\.\d+)?',row['Value'].strip()):
                raise ValueError(('Censored or nonnumeric UHC value requires explicit handling',row))
            points.append((row['SpatialDim'],row['TimeDim'],row['NumericValue']))
    ind.update(source='WHO UHC monitoring report 2025',producer='World Health Organization and World Bank',url=WHO_UHC,api_url=url,last_updated=max(r['Date'][:10] for r in rows),sha256=hashlib.sha256(fp.read_bytes()).hexdigest())
    return ind,points

def build(refresh=False):
    SOURCE.mkdir(parents=True,exist_ok=True);OUT.mkdir(parents=True,exist_ok=True)
    retrieval=SOURCE/'retrieval.json'
    if refresh or not retrieval.exists():
        retrieval.write_text(json.dumps({'retrieved':datetime.date.today().isoformat()},indent=2)+'\n')
    result={'schema':1,'retrieved':read_json(retrieval)['retrieved'],'year_min':1990,'year_max':2024,'indicators':{},'countries':{}}
    for iso,c in COUNTRIES.items():
        result['countries'][iso]={k:c[k] for k in ('name','income_group','wb_region','who_region')}
        result['countries'][iso]['series']={}
    def add(indicator,points):
        key=indicator['id'];result['indicators'][key]=indicator
        years=[];countries=set()
        for iso,year,value in points:
            assert 1990<=year<=2025 and value>=0,(iso,key,year,value)
            s=result['countries'][iso]['series'].setdefault(key,{})
            assert str(year) not in s,(iso,key,year,'duplicate')
            s[str(year)]=value;years.append(year);countries.add(iso)
        indicator.update(n_observations=len(points),n_countries=len(countries),first_year=min(years),last_year=max(years))
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
        for ind,pts in pool.map(lambda s:wb(s,refresh),SPECS):add(ind,pts)
    # Country-level WHO GHO data, not the regional-only report download.
    for ind in [
        dict(id='uhc',code='UHC_INDEX_REPORTED',label='UHC service coverage index',group='Service coverage',unit='Index (0–100)',direction='higher',sdg='SDG 3.8.1',mdg='No direct MDG indicator',note='Revised 2025 service coverage index, using the full re-estimated time series. This is a tracer-based index, not the percentage of people with insurance or effective coverage. It is not spliced to the archived World Bank series.'),
        dict(id='hardship',code='FINANCIALHARDSHIP_PROPORTIONOFPOP',label='Financial hardship from health spending',group='Financial protection',unit='% of population',direction='lower',sdg='SDG 3.8.2 (2025 definition)',mdg='No direct MDG indicator',note='People with positive out-of-pocket health spending exceeding 40% of the household discretionary budget, net of the societal poverty line. Survey-year estimates; the revised definition is not comparable with the older 10% or 25% of total-budget indicators. Zero spending can reflect unmet need rather than protection.')
    ]:
        ind,pts=who(ind,refresh);add(ind,pts)
    result['targets']={
      'sdg':{'u5':{'type':'absolute','value':25,'year':2030,'label':'At most 25 per 1,000','url':UN3},
             'neonatal':{'type':'absolute','value':12,'year':2030,'label':'At most 12 per 1,000','url':UN3},
             'ncd':{'type':'relative','baseline':2015,'factor':2/3,'year':2030,'label':'One-third reduction from 2015','url':UN3},
             'maternal':{'type':'reference','value':70,'year':2030,'label':'Global benchmark: below 70 per 100,000','url':UN3}},
      'mdg':{'u5':{'type':'relative','baseline':1990,'factor':1/3,'year':2015,'label':'Two-thirds reduction from 1990','url':UNMDG},
             'maternal':{'type':'relative','baseline':1990,'factor':1/4,'year':2015,'label':'Three-quarters reduction from 1990','url':UNMDG}}
    }
    result['financing']={'version':META['build']['version'],'sha256':META['build']['payload_sha256'],'url':'https://apps.who.int/nha/database','note':'Shared WHO GHED panel, retrieved 28 May 2026. Compare exact years; 2024 financing observations, where present, are preliminary.'}
    result['peer_presets']=META['peer_presets']
    (OUT/'outcomes.json').write_text(json.dumps(result,ensure_ascii=False,separators=(',',':'),allow_nan=False)+'\n')
    with (OUT/'outcomes.csv').open('w',newline='') as f:
        writer=csv.writer(f,lineterminator="\n");writer.writerow(['iso3','country','indicator','source_code','year','value','unit','source','source_last_updated','source_url'])
        for iso,c in result['countries'].items():
            for key,series in c['series'].items():
                ind=result['indicators'][key]
                for year,value in sorted(series.items()):writer.writerow([iso,c['name'],key,ind['code'],year,value,ind['unit'],ind['source'],ind['last_updated'],ind['url']])
    print(json.dumps({'countries':len(result['countries']),'indicators':len(result['indicators']),'observations':sum(i['n_observations'] for i in result['indicators'].values()),'output':str(OUT)},indent=2))

COUNTRIES=read_json(ROOT/'site/tools/health-financing/data/core.json')['countries']
META=read_json(ROOT/'site/tools/health-financing/data/meta.json')
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--refresh',action='store_true');args=parser.parse_args();build(args.refresh)
