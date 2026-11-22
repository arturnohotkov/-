#!/usr/bin/env python3
"""Record genuine VOROBTSI source code running locally, no production writes.

Requirements: Python >=3.10, playwright, Chromium, Node.js >=22.13, FFmpeg, Git.
"""
from __future__ import annotations
import asyncio
import contextlib
import hashlib
import http.cookiejar
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request
from datetime import date, timedelta
from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeoutError

ROOT = Path(__file__).resolve().parent
REPO = ROOT / "repo_source"
OUT = ROOT / "result"
OUT.mkdir(exist_ok=True)
HOST = "http://127.0.0.1:4173"
LOCAL_KEY = "local-video-shoot-only-keys-not-production"
COMMIT = "81e9100"
# The launched app is the original product, not a slide presentation or a mock UI.

SEGMENTS = []
START = 0.0
LAST_LABEL = None

NARRATIONS = {
    'Головна сторінка': 'Це «Воробці» — цифрова платформа оцінювання доброчесності. Вона об’єднує анонімні анкети, аналітику та управлінські рішення.',
    'Анонімна анкета': 'Курсанти й викладачі можуть проходити опитування без реєстрації та введення імені. Є дванадцять основних запитань і три добровільні практичні ситуації.',
    'Відповіді учасника': 'Кожне запитання має варіанти, що описують рівень зрілості практики. Система переводить їх у шкалу від нуля до ста з кроком двадцять п’ять.',
    'Практичні ситуації': 'Після основних запитань можна розглянути практичні ситуації. Для кожної відповіді система готує конкретну рекомендацію.',
    'Підсумок і пропозиція': 'Перед відправленням учасник переглядає підсумок та рекомендації. Лише за окремою згодою пропозиція передається керівникові без імені та індивідуального бала.',
    'Анкету враховано': 'Після надсилання система враховує відповідь у спільному зборі та оновлює групову статистику.',
    'Огляд керівника': 'У кабінеті керівника відображається загальна кількість анкет, складові доброчесності та доступні групові результати.',
    'Як обчислюються бали': 'П’ять змістовних варіантів кодуються як нуль, двадцять п’ять, п’ятдесят, сімдесят п’ять і сто балів. Середні за групами публікуються після щонайменше семи змістовних відповідей на конкретне запитання.',
    'Пріоритети': 'Система підсвічує практики з нижчими балами та істотними розбіжностями між курсантами й викладачами. Для кожної пропонується причина для перевірки та конкретна дія.',
    'Розбір запитань': 'Керівник може відкрити кожну практику, побачити формулювання, групові бали, пояснення результату та ознаку виконання заходу.',
    'Динаміка': 'Зрізи дозволяють бачити, як змінюється середня оцінка після накопичення наступних групових відповідей.',
    'План заходів': 'Висновки перетворюються на конкретний план: обираємо практику, формулюємо захід, визначаємо відповідального та строк виконання.',
    'Контроль виконання': 'Керівник оновлює статус від запланованого до виконуваного та завершеного. Результат можна порівняти з наступними груповими оцінками.',
    'Звіт і експорт': 'Підсумковий звіт об’єднує групові результати, проблемні практики та прийняті заходи. Дані експортуються у CSV, а друкований звіт можна зберегти як PDF.',
    'Повний Integrity Index': 'Окремий навчальний розрахунок демонструє інтегральний індекс доброчесності установи за трьома джерелами.',
    'Формула 40 / 30 / 30': 'Бал кожної складової — це сорок відсотків результату опитування, тридцять відсотків експертної оцінки та тридцять відсотків документальної перевірки.',
    'Підсумковий розрахунок': 'Повний Integrity Index є середнім балів культури, системи та підзвітності. У навчальному прикладі він становить сімдесят шість цілих дві десятих бала.',
    'Від відповіді до рішення': 'Отже, «Воробці» перетворюють анонімні відповіді на зрозумілі показники, а показники — на управлінські дії з відповідальними, строками та перевіркою результату.'
}


def run(cmd, **kwargs):
    print('>', ' '.join(map(str, cmd)), flush=True)
    return subprocess.run(cmd, check=True, **kwargs)


def ensure_checkout():
    if not (REPO / '.git').exists():
        run(['git', 'clone', '--quiet', 'https://github.com/arturnohotkov/-.git', str(REPO)])
    run(['git', '-C', str(REPO), 'checkout', '--quiet', '--detach', COMMIT])
    # Use isolated storage: never touch real survey, real manager, or users' existing data.
    shutil.rmtree(ROOT/'isolated-data',ignore_errors=True)
    (ROOT / 'isolated-data').mkdir(exist_ok=True)


def post(url, data, opener):
    b=json.dumps(data,ensure_ascii=False).encode('utf-8')
    req=urllib.request.Request(url,data=b,headers={'Content-Type':'application/json'},method='POST')
    with opener.open(req,timeout=10) as resp:
        return json.loads(resp.read().decode('utf-8'))


def seed_synthetic_records():
    # Generate 7 cadet + 7 teacher responses in the isolated local backend.
    # No personal data, no production changes.
    for i in range(14):
        jar=http.cookiejar.CookieJar()
        client=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
        post(HOST+'/api/v1/live-start',{},client)
        cadet = i < 7
        answers = ([1,2,2,3,1,2,3,2,1,2,3,2,1,2,2] if cadet
                   else [3,3,4,4,4,3,4,3,3,4,3,4,3,4,3])
        post(HOST+'/api/v1/live-answer',{
            'group': 'cadets' if cadet else 'teachers',
            'answers': answers,
            'proposal': 'versions' if i in (0,7) else None
        },client)
    print('14 synthetic test surveys seeded (7+7) into isolated SQLite storage.',flush=True)


def timecode(sec):
    n=int(round(max(sec,0)*1000))
    h,n=divmod(n,3600000);m,n=divmod(n,60000);s,ms=divmod(n,1000)
    return f'{h:02}:{m:02}:{s:02},{ms:03}'


def save_narration(duration):
    # Only one paragraph per chapter; no audio or generated voice added.
    lines=[]; srt=[]
    for idx,(t,title,detail) in enumerate(SEGMENTS):
        end=SEGMENTS[idx+1][0] if idx+1<len(SEGMENTS) else duration
        voice=NARRATIONS.get(title,detail)
        lines.append(f'{timecode(t).replace(",",".")} – {timecode(end).replace(",",".")}   {title}\n{voice}\n')
        srt.append(f'{idx+1}\n{timecode(t)} --> {timecode(end)}\n{title}: {detail}\n')
    (OUT/'TEXT_FOR_VOICE.txt').write_text('\n'.join(lines),encoding='utf-8')
    (OUT/'TITLES.srt').write_text('\n'.join(srt),encoding='utf-8')


CSS = """
:root{--video-green:#a9f08a}
#vv-movie-caption{position:fixed!important;bottom:28px!important;left:34px!important;right:34px!important;
 z-index:2147483646!important;display:flex!important;justify-content:space-between!important;align-items:flex-end!important;
 font-family:Arial,sans-serif!important;pointer-events:none!important;transition:opacity .3s,transform .3s!important}
#vv-movie-caption .vv-text{max-width:84%;background:rgba(13,31,31,.91)!important;color:white!important;
 border:1px solid rgba(185,235,201,.32)!important;box-shadow:0 12px 34px rgba(0,0,0,.25)!important;
 border-radius:17px!important;padding:15px 23px 16px!important}
#vv-movie-caption .vv-kicker{font-weight:700!important;color:#a9f08a!important;font-size:14px!important;letter-spacing:1.3px!important}
#vv-movie-caption .vv-title{font-size:27px!important;font-weight:750!important;line-height:1.3!important;margin:2px 0 3px!important}
#vv-movie-caption .vv-description{font-size:18px!important;color:#e2f2e9!important;line-height:1.35!important}
#vv-movie-caption .vv-mark{border-radius:15px!important;padding:10px 14px!important;background:rgba(13,31,31,.88)!important;
 color:#a9f08a!important;font-size:17px!important;font-weight:700!important}
#vv-film-transition{position:fixed!important;inset:0!important;z-index:2147483647!important;
 pointer-events:none!important;background:linear-gradient(115deg,#102f2e 0%,#22594a 50%,#102f2e 100%)!important;
 opacity:0;transition:opacity .32s ease!important}
#vv-film-transition.vv-show{opacity:1!important}
#vv-film-cursor{position:fixed!important;z-index:2147483646!important;pointer-events:none!important;
 width:23px;height:23px;border:3px solid #a9f08a;border-radius:50%;background:rgba(20,54,44,.28);
 box-shadow:0 0 0 5px rgba(165,237,155,.2);left:50%;top:45%;opacity:0;transition:left .3s,top .3s,opacity .3s}
#vv-focus-outline{position:fixed!important;z-index:2147483645!important;pointer-events:none!important;border:3px solid #7ddd8e!important;
 background:rgba(98,207,149,.07)!important;border-radius:8px!important;opacity:0;transition:opacity .25s}
"""


async def visuals(page):
    await page.evaluate("""(css)=>{
      if(document.getElementById('vv-video-style')) return;
      const style=document.createElement('style');style.id='vv-video-style';style.textContent=css;document.head.appendChild(style);
      const wrap=document.createElement('div');wrap.id='vv-movie-caption';wrap.innerHTML='<div class="vv-text"><div class="vv-kicker">ВОРОБЦІ • РОБОТА ПЛАТФОРМИ</div><div class="vv-title"></div><div class="vv-description"></div></div><div class="vv-mark">ВЕКТОР ДОБРОЧЕСНОСТІ</div>';
      const curtain=document.createElement('div');curtain.id='vv-film-transition';
      const cursor=document.createElement('div');cursor.id='vv-film-cursor';
      const outline=document.createElement('div');outline.id='vv-focus-outline';
      document.body.append(wrap,curtain,cursor,outline);
    }""",CSS)


async def title(page, heading, description='', hold=3.0):
    global START, LAST_LABEL
    await visuals(page)
    now=time.monotonic()-START
    if heading!=LAST_LABEL:
        SEGMENTS.append((now,heading,description))
        LAST_LABEL=heading
    await page.evaluate("""([h,d])=>{const root=document.querySelector('#vv-movie-caption');if(root){root.querySelector('.vv-title').textContent=h;root.querySelector('.vv-description').textContent=d}}""",[heading,description])
    await asyncio.sleep(hold)


async def transition(page):
    try:
        await visuals(page)
        await page.evaluate("document.getElementById('vv-film-transition')?.classList.add('vv-show')")
        await asyncio.sleep(.36)
        await page.evaluate("document.getElementById('vv-film-transition')?.classList.remove('vv-show')")
        await asyncio.sleep(.35)
    except Exception:
        pass


async def focus(page, selector, hover=True):
    try:
        e=page.locator(selector).first
        await e.scroll_into_view_if_needed(timeout=3000)
        r=await e.bounding_box()
        if not r:return
        if hover:await page.mouse.move(r['x']+min(45,r['width']/2),r['y']+min(26,r['height']/2),steps=15)
        await page.evaluate("""r=>{const o=document.querySelector('#vv-focus-outline'),c=document.querySelector('#vv-film-cursor');if(o){o.style.cssText+=';opacity:1;left:'+ (r.x-4)+'px;top:'+(r.y-4)+'px;width:'+(r.width+8)+'px;height:'+(r.height+8)+'px'}if(c){c.style.left=(r.x+Math.min(45,r.width/2))+'px';c.style.top=(r.y+Math.min(26,r.height/2))+'px';c.style.opacity='1'}}""",r)
    except Exception as exc:
        print('Focus skipped:',selector,str(exc)[:90],flush=True)


async def safe(page, label, action, pause=.7):
    try:
        await action()
        await asyncio.sleep(pause)
        return True
    except Exception as e:
        print(f'Action skipped [{label}]: {str(e)[:160]}',flush=True)
        return False


async def goto(page,path):
    await page.goto(HOST+path,wait_until='domcontentloaded',timeout=25000)
    await asyncio.sleep(.8)
    await visuals(page)


async def shoot():
    global START
    await asyncio.sleep(.15)
    raw=OUT/'_raw_video'
    raw.mkdir(exist_ok=True)
    async with async_playwright() as p:
        browser=await p.chromium.launch(headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
        context=await browser.new_context(viewport={'width':1600,'height':900},record_video_dir=str(raw),record_video_size={'width':1600,'height':900},accept_downloads=True,color_scheme='light')
        page=await context.new_page()
        START=time.monotonic()
        # 1. Real public interface from original product's local source.
        await goto(page,'/')
        await title(page,'Головна сторінка','Жива платформа: анкета → аналітика → управлінські рішення',5)
        await page.evaluate('window.scrollTo({top:Math.min(document.body.scrollHeight-900,500),behavior:"smooth"})')
        await asyncio.sleep(2)
        await transition(page)
        # 2. Real questionnaire.
        await goto(page,'/survey')
        await title(page,'Анонімна анкета','Курсанти або викладачі • 12 запитань • 3 добровільні ситуації',5)
        await safe(page,'category',lambda:page.locator('select[name="group"]').select_option('cadets'))
        await focus(page,'form#start button')
        await safe(page,'start',lambda:page.locator('#start button').click())
        for i in range(15):
            if i==0:await title(page,'Відповіді учасника','Шкала: 0 / 25 / 50 / 75 / 100 балів',4)
            elif i==12:await title(page,'Практичні ситуації','Три додаткові ситуації за бажанням',3)
            if i in (0,4,8,12,14):await focus(page,'fieldset')
            await safe(page,f'answer {i+1}',lambda:page.locator('form#question input[name="choice"][value="1"]').check(),.3)
            await safe(page,f'next {i+1}',lambda:page.locator('form#question button[type="submit"], form#question button:not([type])').first.click(),.6)
        if await page.locator('form#send').count():
            await title(page,'Підсумок і пропозиція','Персональні рекомендації • окрема згода на передачу пропозиції',5)
            await safe(page,'open personal guidance',lambda:page.locator('details.personal summary').click(),.7)
            await safe(page,'share optional',lambda:page.locator('#send input[name="share"]').check(),.9)
            await focus(page,'#send button:last-of-type')
            await safe(page,'survey submit',lambda:page.locator('form#send button:not([type])').click(),1.5)
            await title(page,'Анкету враховано','Відповіді потрапили до ізольованої тестової бази',4)
        await transition(page)
        # 3. REAL manager UI: local test key, not the user's production secret.
        await goto(page,'/manager')
        if await page.locator('form#login').count():
            await safe(page,'local only manager login',lambda:page.locator('#login input[name="key"]').fill(LOCAL_KEY),.1)
            await safe(page,'login manager',lambda:page.locator('#login button').click(),1.7)
        await title(page,'Огляд керівника','Поточна статистика • групові показники • поріг анонімності',8)
        await focus(page,'#figures')
        await title(page,'Як обчислюються бали','Середнє групи = 25 × сума кодів відповідей / їх кількість',6)
        async def tab(name,heading,subtitle,wait=7):
            await transition(page)
            await safe(page,'tab '+name,lambda:page.locator(f'nav#manager-nav a[href="#{name}"]').click(),.6)
            await title(page,heading,subtitle,wait)
            await page.evaluate('window.scrollTo({top:Math.min(document.body.scrollHeight-900,340),behavior:"smooth"})')
            await asyncio.sleep(1.1)
            await page.evaluate('window.scrollTo({top:0,behavior:"smooth"})')
            await asyncio.sleep(.5)
        await tab('priorities','Пріоритети','Нижчі оцінки • розбіжність груп • конкретні рекомендації',9)
        await tab('questions','Розбір запитань','15 практик • оцінка кожної групи • критерії перевірки',8)
        await safe(page,'expand question',lambda:page.locator('#figures details summary').first.click(),1.8)
        await tab('history','Динаміка','Зміни результатів у наступних зрізах',8)
        await tab('plan','План заходів','Від рекомендації до конкретного управлінського рішення',6)
        await focus(page,'button[data-plan-new]')
        if await safe(page,'new plan',lambda:page.locator('button[data-plan-new]').click(),1.1):
            await title(page,'План заходів','Обираємо практику, захід, відповідального і строк',5)
            await safe(page,'owner',lambda:page.locator('form#plan select[name="owner"]').select_option(label='Навчальний відділ'),.5)
            due=(date.today()+timedelta(days=30)).isoformat()
            await safe(page,'due',lambda:page.locator('form#plan input[name="due"]').fill(due),.5)
            await safe(page,'save plan',lambda:page.locator('form#plan button[type="submit"]').click(),2)
            await title(page,'Контроль виконання','Статуси: заплановано → у роботі → виконано',6)
            if await page.locator('select[data-status]').count():
                await focus(page,'select[data-status]')
                await safe(page,'status active',lambda:page.locator('select[data-status]').first.select_option('active'),2)
                await safe(page,'status done',lambda:page.locator('select[data-status]').first.select_option('done'),2)
        await tab('report','Звіт і експорт','CSV для аналізу даних • PDF через друк браузера',8)
        if await page.locator('button[data-action="csv"]').count():
            async with page.expect_download(timeout=15000) as d:
                await page.locator('button[data-action="csv"]').click()
            await (await d.value).save_as(OUT/'example-export.csv')
        await title(page,'Звіт і експорт','Завантажено справжню таблицю результатів',3)
        # 4. The actual auxiliary page is shown ONLY to explain the full weighted index.
        await transition(page)
        await goto(page,'/vektor.html')
        await title(page,'Повний Integrity Index','Додатковий розрахунок з опитування, експертної та документальної оцінок',5)
        for fragment,heading,desc,duration in [
            ('method','Формула 40 / 30 / 30','C = 0,40 × S + 0,30 × E + 0,30 × D',7),
            ('chart','Підсумковий розрахунок','Integrity Index = (Культура + Система + Підзвітність) / 3',7),
            ('cycles','Підсумковий розрахунок','Приклад навчального циклу: індекс 76,2 / 100',6)]:
            try:
                await page.goto(HOST+'/vektor.html#'+fragment,wait_until='domcontentloaded',timeout=12000)
                await asyncio.sleep(.65);await visuals(page)
                await title(page,heading,desc,duration)
                await page.evaluate('window.scrollTo({top:Math.min(document.body.scrollHeight-900,550),behavior:"smooth"})')
                await asyncio.sleep(1)
            except Exception as e:print('Demo step:',e,flush=True)
        # 5. Finish on actual manager dashboard, not slides.
        await transition(page)
        await goto(page,'/manager')
        await title(page,'Від відповіді до рішення','Анонімна анкета → прозорий розрахунок → план → контроль',6)
        duration=time.monotonic()-START
        save_narration(duration)
        video=page.video
        await context.close()
        source=Path(await video.path())
        await browser.close()
        dest=OUT/'VOROBTSI_working_site_silent.mp4'
        # Slight crop-safe upscale and subtle fade; actual website view remains legible.
        filters=f'scale=1920:1080:flags=lanczos,format=yuv420p,fade=t=in:st=0:d=0.55,fade=t=out:st={max(0,duration-0.75):.2f}:d=0.65'
        run(['ffmpeg','-y','-hide_banner','-loglevel','error','-i',str(source),'-vf',filters,
             '-an','-c:v','libx264','-preset','medium','-crf','21','-movflags','+faststart',str(dest)])
        print('DONE!',dest,'duration',round(duration,1),'sec',flush=True)


def main():
    for cmd in ['git','node','ffmpeg']:
        if not shutil.which(cmd):
            raise SystemExit(f'Missing {cmd}. Install Git, Node 22.13+, FFmpeg before starting.')
    major_minor=tuple(int(i) for i in subprocess.check_output(['node','--version'],text=True).strip()[1:].split('.')[:2])
    if major_minor<(22,13):raise SystemExit('Node.js 22.13+ is required.')
    ensure_checkout()
    env=os.environ.copy()
    env['VECTOR_MANAGER_HASH']=hashlib.sha256(LOCAL_KEY.encode()).hexdigest()
    env['VECTOR_DATA']=str(ROOT/'isolated-data')
    env['PORT']='4173'
    env['VECTOR_MODE']='demo'
    log=(ROOT/'server-log.txt').open('w',encoding='utf-8')
    srv=subprocess.Popen(['node',str(REPO/'offline/server.mjs')],cwd=REPO,env=env,stdout=log,stderr=subprocess.STDOUT)
    try:
        for _ in range(40):
            if srv.poll() is not None:raise RuntimeError('Local application server failed: '+(ROOT/'server-log.txt').read_text()[:1500])
            try:
                urllib.request.urlopen(HOST+'/api/v1/live-info',timeout=1)
                break
            except Exception:time.sleep(.3)
        else:raise RuntimeError('Local site did not start on port 4173. Is port already in use?')
        seed_synthetic_records()
        asyncio.run(shoot())
    finally:
        srv.terminate()
        with contextlib.suppress(Exception):srv.wait(timeout=6)
        log.close()


if __name__=='__main__':
    main()