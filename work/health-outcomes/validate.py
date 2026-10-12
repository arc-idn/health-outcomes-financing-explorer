#!/usr/bin/env python3
"""Validate the actual preview in Chromium, without opening a new server port."""
import json
import mimetypes
from pathlib import Path
import urllib.parse
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[2]
PREVIEW=Path(__file__).resolve().parent/'preview'
if not PREVIEW.exists(): PREVIEW=ROOT/'site/tools/health-outcomes'
SHOTS=ROOT/'docs/screenshots/health-outcomes'
SHOTS.mkdir(parents=True,exist_ok=True)
PREFIX='/tools/health-outcomes/'
import os
BASE=os.environ.get('BASE_URL','http://127.0.0.1:8000')+PREFIX
errors=[]
results=[]

def intercept(route):
    path=urllib.parse.urlparse(route.request.url).path
    rel=path[len(PREFIX):] or 'index.html'
    file=(PREVIEW/rel).resolve()
    if not file.is_relative_to(PREVIEW.resolve()) or not file.is_file():
        route.fulfill(status=404,body='Missing preview file');return
    route.fulfill(status=200,body=file.read_bytes(),content_type=mimetypes.guess_type(str(file))[0] or 'application/octet-stream')

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True)
    context=browser.new_context(viewport={'width':1440,'height':1000},device_scale_factor=1)
    context.route('**/tools/health-outcomes/**',intercept)
    page=context.new_page()
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
    for width in [1440,390]:
        page.set_viewport_size({'width':width,'height':1000})
        for view in ['trends','targets','compare','data']:
            page.goto(BASE+'?view='+view,wait_until='networkidle')
            page.locator('#content[aria-busy="false"]').wait_for()
            assert page.locator('h2').count()>0
            overflow=page.evaluate('document.documentElement.scrollWidth > innerWidth+1')
            assert not overflow,(width,view,'page overflow')
            assert page.locator('#content .error').count()==0
            page.screenshot(path=str(SHOTS/f'{view}-{width}.png'),full_page=True)
            results.append({'view':view,'width':width,'overflow':overflow})
    page.set_viewport_size({'width':1440,'height':1000})
    page.goto(BASE,wait_until='networkidle')
    # A normal click must not bubble into the body's styling data-view attribute.
    country=page.get_by_label('Country',exact=True)
    country.evaluate('(e)=>window.originalCountryControl=e')
    country.click()
    assert country.evaluate('(e)=>e===window.originalCountryControl'),'Dropdown was replaced on opening'
    page.keyboard.press('Escape')
    assert page.get_by_label('Outcome on the X axis').locator('option').count()==23
    for key in ['uhc','hardship','u5']:
        page.get_by_label('Outcome on the X axis').select_option(key)
        assert page.get_by_label('Health indicator',exact=True).input_value()==key
    page.get_by_label('Financing on the Y axis').select_option('total')
    page.locator('[data-trajectory-key="priceBasis"][data-value="nominal"]').click()
    point=page.locator('#trend-trajectory [data-country-code="IDN"][data-point-year="2003"]')
    assert abs(float(point.get_attribute('data-y'))-(25.51065636+5.02521214538846))<1e-9
    assert 'current US$ per capita' in page.locator('.trajectory-axis-note').inner_text()
    with page.expect_download() as dl:page.get_by_role('button',name='Download trajectory CSV').click()
    dl.value.save_as(str(SHOTS/'nominal-trajectory.csv'))
    nominal_csv=(SHOTS/'nominal-trajectory.csv').read_text()
    assert '"nominal"' in nominal_csv and 'che_pc_usd + hk_usd_pc' in nominal_csv
    page.reload(wait_until='networkidle')
    assert page.locator('[data-trajectory-key="priceBasis"][data-value="nominal"]').get_attribute('aria-pressed')=='true'
    page.locator('[data-trajectory-key="priceBasis"][data-value="real"]').click()
    point=page.locator('#trend-trajectory [data-country-code="IDN"][data-point-year="2003"]')
    assert abs(float(point.get_attribute('data-y'))-(51.286277637821804+10.1026183930959))<1e-9
    page.locator('#trajectory-section').screenshot(path=str(SHOTS/'real-prices-1440.png'))
    page.locator('[data-trajectory-key="priceBasis"][data-value="nominal"]').click()
    page.locator('[data-trajectory-key="spendingMode"][data-value="cumulative"]').click()
    assert page.locator('[data-trajectory-key="priceBasis"][data-value="real"]').get_attribute('aria-pressed')=='true'
    assert page.locator('[data-trajectory-key="priceBasis"][data-value="nominal"]').is_disabled()
    page.goto(BASE,wait_until='networkidle')
    assert page.locator('#trend-trajectory [data-trajectory-point]').count()==15
    own=page.locator('#trend-trajectory [data-country-code="IDN"][data-point-year="2023"]')
    assert float(own.get_attribute('data-x'))==18.4
    assert [int(y) for y in page.locator('#trend-trajectory [data-country-code="IDN"]').evaluate_all('(els)=>els.map(e=>e.dataset.pointYear)')]==[2003,2008,2013,2018,2023]
    for width in [1440,390]:
        page.set_viewport_size({'width':width,'height':1000})
        page.locator('.country-picker summary').click()
        page.get_by_label('Find a country').fill('viet')
        checkbox=page.locator('[data-trajectory-country="VNM"]')
        checkbox.evaluate('(e)=>window.originalCheckbox=e')
        checkbox.check()
        assert page.locator('.country-picker').evaluate('(e)=>e.open')
        assert checkbox.evaluate('(e)=>e===window.originalCheckbox')
        assert page.get_by_label('Find a country').input_value()=='viet'
        assert page.locator('#trend-trajectory [data-trajectory-series="VNM"]').count()==1
        page.locator('[data-close-picker]').click()
        page.locator('#trajectory-section').screenshot(path=str(SHOTS/f'trajectory-{width}.png'))
    page.locator('[data-trajectory-key="trajectoryScale"][data-value="index"]').click()
    base=page.locator('#trend-trajectory [data-country-code="IDN"][data-point-year="2003"]')
    assert float(base.get_attribute('data-x'))==100 and float(base.get_attribute('data-y'))==100
    page.locator('[data-trajectory-key="spendingMode"][data-value="cumulative"]').click()
    assert page.get_by_label('Financing on the Y axis').input_value()=='current'
    page.locator('[data-trajectory-key="trajectoryScale"][data-value="level"]').click()
    page.get_by_label('Financing on the Y axis').select_option('total')
    assert page.locator('#trend-trajectory [data-country-code="IDN"][data-point-year="2023"]').count()==0
    assert page.locator('#trend-trajectory [data-country-code="IDN"][data-point-year="2018"]').count()==1
    assert 'Missing capital is not zero' in page.locator('#trajectory-result').inner_text()
    page.locator('.country-picker summary').click()
    page.get_by_label('Find a country').fill('philippines')
    page.locator('[data-trajectory-country="PHL"]').check()
    page.locator('[data-close-picker]').click()
    assert page.locator('#trend-trajectory [data-country-code="PHL"][data-point-year="2023"]').count()==1
    page.locator('#trajectory-section').screenshot(path=str(SHOTS/'trajectory-capital-390.png'))
    with page.expect_download() as dl:page.get_by_role('button',name='Download trajectory CSV').click()
    dl.value.save_as(str(SHOTS/'trajectory.csv'))
    import csv
    exported=list(csv.DictReader((SHOTS/'trajectory.csv').read_text(encoding='utf-8-sig').splitlines()))
    assert len(exported)==5*21 and sum(r['five_year_plot_point']=='true' for r in exported)==5*5
    missing=next(r for r in exported if r['iso3']=='IDN' and r['year']=='2023')
    assert missing['financing_value']=='' and missing['observed_spending_years']=='17'
    page.reload(wait_until='networkidle')
    assert page.get_by_label('Financing on the Y axis').input_value()=='total'
    assert page.locator('[data-trajectory-key="spendingMode"][data-value="cumulative"]').get_attribute('aria-pressed')=='true'
    assert page.locator('#trend-trajectory [data-trajectory-series="PHL"]').count()==1
    page.set_viewport_size({'width':1440,'height':1000})
    page.goto(BASE,wait_until='networkidle')
    page.get_by_label('Indicator group',exact=True).select_option('Service coverage')
    page.get_by_label('Health indicator',exact=True).select_option('uhc')
    assert page.get_by_label('Outcome on the X axis').input_value()=='uhc'
    assert '67.0' in page.locator('#trend-outcome .inspect-item').first.inner_text()
    assert page.locator('#trend-outcome path[data-series]').count()==5
    assert page.locator('#trend-finance path[data-series]').count()==5
    page.locator('[data-chart-scale="index"]').click()
    assert '100' in page.locator('#trend-outcome .inspect-year').inner_text()
    chart=page.locator('#trend-outcome>svg');chart.focus();chart.press('Home')
    assert '100.0' in page.locator('#trend-outcome .inspect-item').first.inner_text()
    chart.press('End')
    page.screenshot(path=str(SHOTS/'baseline-index-1440.png'),full_page=True)
    page.locator('[data-chart-scale="change"]').click()
    assert '21.0' in page.locator('#trend-outcome .inspect-item').first.inner_text()
    page.locator('[data-benchmark="region"]').click()
    assert page.locator('#trend-outcome path[data-series]').count()==4
    assert page.locator('[data-benchmark="region"]').get_attribute('aria-pressed')=='false'
    page.reload(wait_until='networkidle')
    assert page.locator('#trend-outcome path[data-series]').count()==4
    assert page.locator('[data-chart-scale="change"]').get_attribute('aria-pressed')=='true'
    page.get_by_label('Country',exact=True).select_option('THA')
    page.locator('[data-view="compare"]').first.click()
    page.get_by_label('Financing precedes outcome',exact=True).select_option('5')
    assert '2018' in page.locator('.section-head').inner_text()
    with page.expect_download() as dl:page.get_by_role('button',name='Download CSV',exact=True).click()
    downloaded=dl.value
    downloaded.save_as(str(SHOTS/'comparison.csv'))
    assert '2018' in (SHOTS/'comparison.csv').read_text()
    page.reload(wait_until='networkidle')
    assert page.get_by_label('Country',exact=True).input_value()=='THA'
    assert page.get_by_label('Financing precedes outcome',exact=True).input_value()=='5'
    page.locator('[data-view="targets"]').click()
    page.get_by_label('Development framework',exact=True).select_option('mdg')
    assert '1990' in page.locator('thead').inner_text() and '2015' in page.locator('thead').inner_text()
    page.goto(BASE+'?view=compare&indicator=fp&iso=SGP&year=2023',wait_until='networkidle')
    assert 'Not available' in page.locator('.stats').inner_text()
    assert page.locator('.chart-empty').count() or page.locator('#scatter circle').count()
    page.goto(BASE+'?view=trends&year=1990&start=2023',wait_until='networkidle')
    assert 'NaN' not in page.locator('#content').inner_text()
    page.goto(BASE+'?view=trends&indicator=fp&iso=IDN&year=2023&cohort=available',wait_until='networkidle')
    assert 'country mix' in page.locator('.trend-method').inner_text()
    assert page.locator('#content .error').count()==0
    page.goto(BASE+'?view=trends&iso=IDN&indicator=u5&scale=change',wait_until='networkidle')
    assert '-26.2' in page.locator('#trend-outcome .inspect-item').first.inner_text()
    page.screenshot(path=str(SHOTS/'change-1440.png'),full_page=True)
    page.get_by_label('Country',exact=True).select_option('ETH')
    assert 'Sub-Saharan Africa' in page.locator('.benchmark-definitions').inner_text()
    page.set_viewport_size({'width':390,'height':844})
    page.locator('[data-chart-scale="index"]').click()
    assert not page.evaluate('document.documentElement.scrollWidth>innerWidth+1')
    page.screenshot(path=str(SHOTS/'baseline-index-390.png'),full_page=True)
    with page.expect_download() as dl:page.get_by_role('button',name='Download CSV',exact=True).click()
    dl.value.save_as(str(SHOTS/'trend-benchmarks.csv'))
    export=(SHOTS/'trend-benchmarks.csv').read_text()
    assert 'observed_countries' in export and 'baseline_value' in export and '"world"' in export
    page.set_viewport_size({'width':1440,'height':1000})
    page.goto(BASE+'?view=compare&iso=IDN&indicator=hardship&year=2023&peers=world',wait_until='networkidle')
    page.screenshot(path=str(SHOTS/'hardship-world.png'),full_page=True)
    page.goto(BASE+'?view=trends&indicator=uhc',wait_until='networkidle')
    page.pdf(path=str(SHOTS/'uhc-indonesia.pdf'),format='A4',print_background=True)
    assert not errors,errors
    browser.close()
(ROOT/'docs/health-outcomes-validation.json').write_text(json.dumps({'views':results,'browser_errors':errors,'interactions':['country','indicator group','indicator','lag','CSV download','reload state','MDG switch','missing data','1990 bounds','world hardship','PDF','five trend lines','baseline index','change from baseline','benchmark toggle','cohort mode','arrow-key year inspection','trend export denominators','regional membership updates','native dropdown opening preserves DOM','persistent comparison picker on desktop and mobile','five-year trajectory and X-outcome orientation','trajectory index toggle','annual/cumulative toggle','current plus capital with missing-year propagation','trajectory yearly CSV and completeness','trajectory shared URL state','local outcome selector and page synchronisation','annual nominal and real source values','price basis CSV and URL persistence','cumulative forces real prices']},indent=2)+'\n')
print('PASS: four views at desktop/mobile, interactions, export, print, no browser errors or page overflow.')
