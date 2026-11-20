#!/usr/bin/env python3
"""Generate and render the public 'Воробці' competition introduction with Ukrainian neural narration.
Generates a 1280x720 MP4 and matching poster inside output directory.
No keys or personal data. This is synthetic visual explanation, not real survey data.
Requires edge-tts, pillow and ffmpeg. Uses the script at the bottom as ground truth.
"""
import asyncio
import math
import os
from pathlib import Path
import shutil
import subprocess
import sys
import time

from PIL import Image, ImageDraw, ImageFont
from io import BytesIO
from functools import lru_cache
import xml.etree.ElementTree as ET

SCENES = [
  {
    "tag": "ЗАВДАННЯ 03  •  ВІКНУ",
    "title": "Доброчесність,\nяку можна оцінити",
    "sub": "Команда «Воробці»  /  Integrity Management Dashboard",
    "metric": "03", "metric_label": "складові оцінювання",
    "lines": ["Культура доброчесності", "Система доброчесності", "Підзвітність"],
    "narr": "Уявіть, що керівник може не просто отримати результати опитування, а зрозуміти, де потрібні зміни. Команда «Воробці», Військовий інститут Київського національного університету, представляє третє конкурсне завдання: Integrity Management Dashboard."
  },
  {
    "tag": "01  /  ПЕРЕД АНКЕТОЮ",
    "title": "Усе починається\nз голосу людини",
    "sub": "Одна платформа для курсантів і викладачів",
    "metric": "2", "metric_label": "групи учасників",
    "lines": ["Без зазначення імені", "Особистий досвід — замість формальності", "Зручний доступ із телефону"],
    "narr": "Курсант і викладач отримують одне посилання, але відповідають на зрозумілі для своєї ролі запитання. Ім'я вводити не потрібно. Нас цікавить реальний досвід: наскільки зрозумілі правила і чи знає людина, як діяти."
  },
  {
    "tag": "02  /  АНКЕТУВАННЯ",
    "title": "12 запитань.\n3 реальні ситуації.",
    "sub": "Зрозумілі відповіді та індивідуальні підказки",
    "metric": "12+3", "metric_label": "основні питання та ситуації",
    "lines": ["Дві версії одного правила", "Консультант тимчасово відсутній", "Звернення без підтвердження"],
    "narr": "Спочатку дванадцять основних запитань, далі — три додаткові ситуації. Наприклад, на стенді та в чаті різні правила. Або консультант недоступний. Система не просто фіксує варіант відповіді: вона підказує, що можна покращити."
  },
  {
    "tag": "03  /  ЗВОРОТНИЙ ЗВ’ЯЗОК",
    "title": "Пропозиція має\nдійти до керівника",
    "sub": "Учасник сам обирає, чи передати рекомендацію",
    "metric": "✓", "metric_label": "добровільне надсилання",
    "lines": ["Конкретна пропозиція", "Окрема згода учасника", "Без імен та персональних балів"],
    "narr": "Навіть якщо учасник задоволений усім, він може запропонувати поліпшення. Рекомендація передається керівнику тільки після окремої згоди. Так корисні ідеї не губляться серед цифр."
  },
  {
    "tag": "04  /  АНАЛІТИКА",
    "title": "Не просто середнє.\nПорівняння й динаміка.",
    "sub": "Групові оцінки відкриваються після порога анонімності",
    "metric": "7", "metric_label": "відповідей для групового бала",
    "lines": ["Окремо курсанти та викладачі", "Бали від 0 до 100", "Історія зрізів і графік змін"],
    "narr": "У кабінеті керівника показані оцінки курсантів і викладачів, історія зрізів та графік змін. Груповий бал відкривається після семи змістовних відповідей. Це допомагає бачити тенденції, не показуючи особистих результатів."
  },
  {
    "tag": "05  /  УПРАВЛІНСЬКИЙ ПРІОРИТЕТ",
    "title": "Кожній проблемі —\nконкретна відповідь",
    "sub": "Висновки залежать від бала й розриву між групами",
    "metric": "15", "metric_label": "практик із рекомендаціями",
    "lines": ["Що саме перевірити", "Яку дію доручити", "Як підтвердити виконання"],
    "narr": "Тепер для всіх п'ятнадцяти практик система формує предметні рекомендації. Вона розрізняє прогалини, часткове впровадження, стабільні результати й різницю між групами. Для кожного випадку є перевірка, конкретна дія та ознака виконання."
  },
  {
    "tag": "06  /  ПЛАН ЗАХОДІВ",
    "title": "Від аналітики\nдо рішення керівника",
    "sub": "Практика  •  Відповідальний  •  Строк  •  Статус",
    "metric": "→", "metric_label": "дія замість формального звіту",
    "lines": ["Сформувати управлінський захід", "Призначити відповідальних", "Перевірити реальний результат"],
    "narr": "Обрану рекомендацію можна перетворити на захід: вказати відповідального, строк, очікуваний результат і статус. Керівник отримує не перелік побажань, а практичний план роботи. Локально збережені заходи залишаються доступними на пристрої їх створення."
  },
  {
    "tag": "07  /  ПІДСУМКИ",
    "title": "Рішення, які можна\nперевірити",
    "sub": "Графіки, звіт, експорт CSV і друк PDF",
    "metric": "360°", "metric_label": "повний цикл роботи з оцінкою",
    "lines": ["Оцінити стан", "Визначити пріоритет", "Повторно перевірити результат"],
    "narr": "У звіті зібрані групові бали, пріоритети й обрані заходи. Результати можна завантажити в CSV або зберегти як PDF. Повторне оцінювання допоможе зрозуміти, чи справді зміни покращили практику."
  },
  {
    "tag": "КОМАНДА «ВОРОБЦІ»",
    "title": "Доброчесність\nпочинається з дії",
    "sub": "Від оцінювання — до довіри",
    "metric": "✓", "metric_label": "готові до участі",
    "lines": ["Оберіть свою категорію", "Пройдіть анкету", "Допоможіть зробити систему кращою"],
    "narr": "«Воробці» поєднують голос учасників, аналітику і зрозумілі управлінські рішення. Це цифровий інструмент для тих, хто хоче не лише говорити про доброчесність, а й змінювати її на практиці. Долучайтеся до оцінювання."
  }
]

ROOT=Path(__file__).resolve().parents[1]
OUTPUT=Path(os.environ.get("VIDEO_OUTPUT", ROOT/"rendered-video")).resolve()
WORK=OUTPUT/"build"
WIDTH,HEIGHT=1280,720
VOICE=os.environ.get("VIDEO_VOICE","uk-UA-PolinaNeural")
FONT="/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FONT_BOLD="/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

def run(args):
    subprocess.run(args,check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)

def ffprobe(path):
    p=subprocess.run(["ffprobe","-v","error","-show_entries","format=duration","-of","default=noprint_wrappers=1:nokey=1",str(path)],capture_output=True,text=True,check=True)
    return float(p.stdout.strip())

def font(size,bold=False):
    return ImageFont.truetype(FONT_BOLD if bold else FONT,size)

def rr(draw, rect, r, fill, outline=None, width=1):
    draw.rounded_rectangle(rect, radius=r,fill=fill,outline=outline,width=width)

# The earlier interactive presentation used rich glass cards, lime accents and distinct
# scenes. Bring those elements into the real narrated MP4 instead of repeating
# a single static information card across all nine sections.
def label(d, xy, text, size, color=(242,249,235), bold=False, spacing=None):
    d.text(xy, text, font=font(size,bold), fill=color, spacing=spacing)

def card(d, rect, fill=(21,53,41), border=(98,145,103), radius=22):
    rr(d, rect, radius, fill, border, 2)

def chip(d, xy, text, fill=(42,92,65), color=(212,246,174), width=None):
    x,y=xy
    f=font(16,True)
    w=width or max(115,int(d.textlength(text,font=f))+35)
    rr(d,(x,y,x+w,y+37),17,fill)
    label(d,(x+17,y+8),text,16,color,True)
    return w

def draw_metric(d,x,y,value,name):
    card(d,(x,y,x+191,y+125),(238,248,231),(238,248,231),17)
    label(d,(x+21,y+13),value,47,(30,90,56),True)
    label(d,(x+21,y+78),name,13,(69,96,75),True)

@lru_cache(maxsize=3)
def site_mark(pixels=48, transparent=False):
    """Rasterize the exact public/mark.svg — the dark Latin V, not Cyrillic В."""
    from cairosvg import svg2png
    svg_file=ROOT/"public"/"mark.svg"
    if not svg_file.is_file():raise RuntimeError("Official mark.svg missing")
    svg=ET.parse(svg_file)
    if transparent:
        for child in list(svg.getroot()):
            if child.tag.endswith("rect"):
                svg.getroot().remove(child)
    payload=ET.tostring(svg.getroot(),encoding="utf-8")
    image=svg2png(bytestring=payload,output_width=pixels,output_height=pixels)
    return Image.open(BytesIO(image)).convert("RGBA")

def draw_visual(d,kind):
    accent=(193,244,128)
    white=(239,247,231)
    dim=(183,212,186)
    left=728
    if kind==0:
        # Hero from the original design: oversized Index motif + floating mini dashboard
        card(d,(724,148,1190,567),(17,52,38),(94,144,104),24)
        label(d,(757,171),"INTEGRITY  /  MANAGEMENT",15,accent,True)
        label(d,(758,203),"03",142,accent,True)
        label(d,(978,263),"складові",17,dim)
        for i,(title,length) in enumerate((("Культура",298),("Система",235),("Підзвітність",265))):
            y=376+i*54
            label(d,(759,y),title,17,white,True)
            rr(d,(881,y+5,1154,y+19),6,(44,78,60))
            rr(d,(881,y+5,881+length*0.84,y+19),6,((118+i*17),198,107))
    elif kind==1:
        # Two distinct participant cards, not imaginary personal data.
        card(d,(727,158,944,557),(237,248,231),(244,253,236),22)
        card(d,(955,189,1186,530),(19,56,41),(100,160,111),22)
        d.ellipse((780,210,883,313),fill=(79,144,99))
        label(d,(812,228),"К",57,white,True)
        label(d,(760,344),"Курсанти",28,(31,83,51),True)
        label(d,(760,388),"Анонімні відповіді",14,(76,108,82))
        d.ellipse((1013,235,1116,338),fill=(171,229,116))
        label(d,(1046,252),"В",57,(21,59,36),True)
        label(d,(980,370),"Викладачі",26,white,True)
        label(d,(980,414),"Порівняння груп",15,dim)
        chip(d,(810,504),"Одна анкета",(34,101,63))
    elif kind==2:
        # Mobile survey UI modeled on the site: question, radio choices, progress.
        card(d,(768,122,1148,594),(230,244,230),(241,252,233),29)
        rr(d,(891,133,1018,145),6,(57,107,77))
        label(d,(803,165),"ЗАПИТАННЯ 04 / 12",15,(51,111,78),True)
        rr(d,(803,202,1113,212),5,(191,217,193))
        rr(d,(803,202,935,212),5,(52,136,75))
        label(d,(803,233),"Як діяти, якщо",23,(28,66,47),True)
        label(d,(803,264),"бракує інформації?",23,(28,66,47),True)
        for j,t in enumerate(("Знайти чинне правило","Звернутися по пораду","Уточнити обставини")):
            y=322+j*54
            rr(d,(801,y,1114,y+44),12,(241,249,235) if j!=1 else (203,232,197),(167,205,176))
            d.ellipse((817,y+11,838,y+32),outline=(40,128,71),width=3)
            if j==1:d.ellipse((824,y+18,831,y+25),fill=(40,128,71))
            label(d,(854,y+13),t,16,(34,76,51),True)
        chip(d,(931,531),"ДАЛІ",(37,115,70),width=155)
    elif kind==3:
        # Consent/feedback diagram
        card(d,(726,156,1192,550),(230,247,229),(250,252,241),23)
        label(d,(761,183),"ВАША ПРОПОЗИЦІЯ",17,(45,115,68),True)
        label(d,(760,232),"Уточнити доступ",27,(28,73,46),True)
        label(d,(760,270),"до чинних правил",27,(28,73,46),True)
        rr(d,(760,334,1152,404),14,(210,230,208))
        rr(d,(777,354,808,384),7,(47,137,78))
        label(d,(784,354),"✓",22,(250,250,238),True)
        label(d,(825,355),"Передати керівникові",21,(31,83,51),True)
        chip(d,(760,446),"ПРОПОЗИЦІЮ ПРИЙНЯТО",(33,103,65),width=344)
    elif kind==4:
        # Group comparison card — symbolic unlabelled bars rather than fake scores.
        card(d,(725,148,1192,565),(231,244,228),(251,251,237),25)
        label(d,(757,176),"ПОРІВНЯННЯ ГРУП",17,(34,94,61),True)
        for i,(t,width,col) in enumerate((("Курсанти",210,(55,124,83)),("Викладачі",293,(142,198,96)))):
            y=257+i*95
            label(d,(756,y-5),t,21,(32,75,48),True)
            rr(d,(759,y+34,1151,y+58),12,(198,220,198))
            rr(d,(759,y+34,759+width,y+58),12,col)
        label(d,(757,486),"ЗРІЗИ  •  ДИНАМІКА  •  РОЗБІЖНОСТІ",15,(63,106,79),True)
        for i in range(6):
            d.ellipse((761+i*28,518,770+i*28,527),fill=(67,126,87) if i==5 else (182,210,180))
    elif kind==5:
        # Actual range labels (not random buzzwords).
        card(d,(726,137,1192,584),(16,52,37),(95,156,112),24)
        label(d,(758,163),"ВІД ДАНИХ ДО ПРІОРИТЕТУ",16,accent,True)
        for i,(tag,title,fill) in enumerate((
            ("40–46","Потребують розвитку",(123,75,43)),
            ("47–53","Часткове впровадження",(123,92,43)),
            ("54–59","Поступове зміцнення",(64,99,55)),
            ("60–79","Стабільна практика",(35,104,64)))):
            y=213+i*82
            rr(d,(754,y,1160,y+67),15,(29,70,49))
            chip(d,(765,y+14),tag,fill,width=111)
            label(d,(890,y+19),title,17,white,True)
        label(d,(759,553),"Оцінка визначає зміст рекомендації",12,dim)
    elif kind==6:
        # Kanban-inspired management plan.
        card(d,(724,154,1191,558),(233,246,228),(239,252,233),24)
        label(d,(756,178),"УПРАВЛІНСЬКИЙ ЗАХІД",16,(37,105,66),True)
        label(d,(754,218),"Оновити інструкцію",26,(26,75,46),True)
        for i,(name,val) in enumerate((
            ("Практика","Доступ до правил"),
            ("Відповідальний","Навчальний відділ"),
            ("Контроль","Строк і результат"))):
            y=279+i*75
            rr(d,(755,y,1157,y+62),12,(210,230,208))
            label(d,(772,y+10),name,13,(71,105,76))
            label(d,(772,y+31),val,16,(29,79,45),True)
        chip(d,(937,514),"У РОБОТІ",(37,104,66),width=192)
    elif kind==7:
        # Chart and export — illustrative plot with no invented actual survey numbers.
        card(d,(726,144,1191,571),(232,246,230),(241,250,235),23)
        label(d,(755,170),"ЗВІТ  /  ОЦІНЮВАННЯ",17,(42,110,70),True)
        label(d,(755,207),"Історія змін",26,(31,80,49),True)
        for y in [308,368,427]:
            d.line((771,y,1161,y),fill=(201,221,200),width=2)
        coords=[(779,417),(845,387),(913,398),(981,341),(1052,350),(1141,297)]
        d.line(coords,fill=(45,131,77),width=6,joint="curve")
        for x,y in coords:d.ellipse((x-7,y-7,x+7,y+7),fill=(94,175,92),outline=(239,251,235),width=3)
        chip(d,(755,472),"CSV",(36,105,71),width=115)
        chip(d,(883,472),"PDF",(38,109,76),width=115)
        chip(d,(1010,472),"ДИНАМІКА",(48,122,81),width=149)
        label(d,(755,536),"СХЕМА ВІЗУАЛІЗАЦІЇ",13,(77,116,83))
    else:
        card(d,(731,145,1189,567),(18,53,39),(93,151,99),26)
        d.ellipse((806,179,1115,488),outline=(101,180,98),width=5)
        d.ellipse((841,213,1081,453),fill=(183,240,124))
        # The V is pasted from the official SVG after the vector art is drawn.
        label(d,(802,500),"КОМАНДА «ВОРОБЦІ»",18,accent,True)
    return

def render_slide(s,number):
    # Premium editorial slide system inspired by the original animated web deck.
    from PIL import ImageFilter
    im=Image.new("RGB",(WIDTH,HEIGHT),(7,27,21))
    px=im.load()
    shift=number*43
    for y in range(HEIGHT):
        for x in range(WIDTH):
            halo=max(0,1-math.hypot((x-(1070-shift))/880,(y-(195+shift//3))/600))
            horizon=max(0,1-math.hypot((x-300)/1200,(y-730)/720))
            px[x,y]=(int(7+halo*16+horizon*3),int(26+halo*31+horizon*8),int(21+halo*19+horizon*4))
    d=ImageDraw.Draw(im)
    # Fine grid in the background and glowing organic orb.
    for x in range(43,WIDTH,113):d.line((x,0,x,HEIGHT),fill=(26,56,43),width=1)
    for y in range(72,HEIGHT,94):d.line((0,y,WIDTH,y),fill=(20,49,39),width=1)
    d.ellipse((1010-number*9,34,1312-number*9,337),outline=(52,107,67),width=2)
    d.ellipse((1085-number*6,106,1250-number*6,271),outline=(56,122,69),width=2)
    # Masthead / brand treatment.
    # Use the exact public site icon; preserves the lime tile and stylized Latin V.
    emblem=site_mark(48)
    im.paste(emblem,(64,45),emblem)
    label(d,(127,48),"ВОРОБЦІ",26,(248,250,234),True)
    label(d,(127,81),"ВЕКТОР ДОБРОЧЕСНОСТІ",12,(164,203,164),True)
    rr(d,(1054,52,1201,89),19,(39,78,52))
    label(d,(1071,61),f"СЦЕНА {number+1:02d} / 09",14,(212,245,167),True)
    # 2-column hero, white/bright-lime brand title. Never copy old generic card.
    label(d,(81,146),s["tag"],16,(199,238,133),True)
    ty=202
    chunks=s["title"].split("\n")
    for i,t in enumerate(chunks):
        label(d,(79,ty+i*68),t,49 if len(t)>23 else 54,
              (190,241,125) if i==len(chunks)-1 else (248,251,237),True)
    subfont=font(18)
    line=""
    sy=370
    for word in s["sub"].split(" "):
        trial=(line+" "+word).strip()
        if d.textlength(trial,font=subfont)>580 and line:
            label(d,(82,sy),line,18,(187,219,193))
            sy+=29;line=word
        else:line=trial
    if line:label(d,(82,sy),line,18,(187,219,193))
    # Follow original deck with expressive, *different* analytics visuals.
    draw_visual(d,number)
    if number==len(SCENES)-1:
        large_v=site_mark(176,transparent=True)
        im.paste(large_v,(873,246),large_v)
    d.line((79,616,1198,616),fill=(57,98,68),width=2)
    for j in range(len(SCENES)):
        rr(d,(81+j*23,646,93+j*23,656),5,(187,235,126) if j==number else (63,109,71))
    label(d,(1036,637),"ВІКНУ · 2026",14,(172,210,181),True)
    out=WORK/f"slide-{number:02}.png"
    im.save(out,optimize=True)
    return out

# Restore the original, natural Ukrainian neural narration used in the first MP4.
# No combining accent marks, dictionary substitutions, or word-by-word stress. Restore the initial voice cadence verbatim.
async def make_voice(s,filename):
    import edge_tts
    last_error=None
    for attempt in range(4):
        try:
            await edge_tts.Communicate(text=s["narr"],voice=VOICE,rate="-3%",pitch="-2Hz").save(str(filename))
            if filename.stat().st_size<3000:raise RuntimeError("Audio is unexpectedly short")
            return
        except Exception as e:
            last_error=e
            if filename.exists():filename.unlink()
            await asyncio.sleep(2*(attempt+1))
    raise RuntimeError("Natural Ukrainian voice generation failed after retries: "+str(last_error))

def write_captions(path, durations):
    """Plain Ukrainian closed captions. Pauses follow the actual audio length."""
    import textwrap
    cues=["WEBVTT",""]
    current=0.0
    def stamp(seconds):
        ms=round(seconds*1000)
        hh,ms=divmod(ms,3600000)
        mm,ms=divmod(ms,60000)
        ss,ms=divmod(ms,1000)
        return f"{hh:02}:{mm:02}:{ss:02}.{ms:03}"
    for scene,duration in zip(SCENES,durations):
        blocks=textwrap.wrap(scene["narr"],width=77,break_long_words=False,
                             break_on_hyphens=False)
        # 2 caption lines per cue. Segments are distributed over the real voice
        # duration, excluding the end pause of 1.25s.
        groups=["\n".join(blocks[i:i+2]) for i in range(0,len(blocks),2)]
        voiced=max(2.0,duration-1.25)
        weights=[max(1,len(g)) for g in groups]
        total=sum(weights)
        t=current
        for text,weight in zip(groups,weights):
            end=min(current+voiced,t+voiced*(weight/total))
            cues.append(f"{stamp(t)} --> {stamp(end)}")
            cues.append(text)
            cues.append("")
            t=end
        current+=duration
    path.write_text("\n".join(cues),encoding="utf8")

async def main():
    for tool in ["ffmpeg","ffprobe"]:
        if not shutil.which(tool):raise RuntimeError(tool+" unavailable")
    if not Path(FONT).exists():raise RuntimeError("DejaVu font not installed on runner")
    OUTPUT.mkdir(parents=True,exist_ok=True);WORK.mkdir(parents=True,exist_ok=True)
    cliplist=[]
    durations=[]
    for i,s in enumerate(SCENES):
        path=render_slide(s,i)
        audio=WORK/f"voice-{i:02}.mp3"
        print(f"Creating Ukrainian neural narration {i+1}/{len(SCENES)}...",flush=True)
        await make_voice(s,audio)
        duration=ffprobe(audio)+1.25
        durations.append(duration)
        movie=WORK/f"clip-{i:02}.mp4"
        fadeout=max(.15,duration-.48)
        # Cinematic camera drift over premium slide visuals; retained recorded voice.
        cmd=[
            "ffmpeg","-hide_banner","-loglevel","error","-y",
            "-loop","1","-framerate","24","-i",str(path),
            "-i",str(audio),
            "-filter_complex",(
                "[0:v]scale=1360:765,"
                "crop=1280:720:x='(iw-ow)*n/480':y='(ih-oh)/2',"
                "fps=24,format=yuv420p,"
                "fade=t=in:st=0:d=0.36,"
                f"fade=t=out:st={fadeout:.3f}:d=0.42[v];"
                f"[1:a]apad=pad_dur=2,atrim=0:{duration:.3f},"
                f"afade=t=out:st={fadeout:.3f}:d=0.42[a]"
            ),
            "-map","[v]","-map","[a]",
            "-t",f"{duration:.3f}",
            "-c:v","libx264","-preset","veryfast","-crf","25",
            "-r","24","-c:a","aac","-b:a","144k",
            "-movflags","+faststart",str(movie)
        ]
        run(cmd)
        if movie.stat().st_size<20000:raise RuntimeError("Empty video segment")
        cliplist.append(movie)
        print(f"Completed {i+1}/{len(SCENES)} · {duration:.1f}s",flush=True)
    manifest=WORK/"segments.txt"
    manifest.write_text("".join("file '"+str(path)+"'\n" for path in cliplist))
    out=OUTPUT/"vorobtsi-intro.mp4"
    run(["ffmpeg","-hide_banner","-loglevel","error","-y","-f","concat","-safe","0","-i",str(manifest),"-c","copy","-movflags","+faststart",str(out)])
    poster=OUTPUT/"vorobtsi-intro-poster.jpg"
    Image.open(WORK/"slide-00.png").save(poster,quality=87,optimize=True)
    write_captions(OUTPUT/"vorobtsi-intro.uk.vtt",durations)
    if out.stat().st_size<100000 or out.stat().st_size>90000000:raise RuntimeError("Invalid final video size")
    seconds=ffprobe(out)
    if seconds<100 or seconds>230:raise RuntimeError(f"Unexpected video length: {seconds:.1f}s")
    print(f"VIDEO COMPLETE {out} | {seconds:.1f} sec | {out.stat().st_size/1024/1024:.1f} MiB | voice={VOICE}",flush=True)

if __name__=="__main__":
    asyncio.run(main())
