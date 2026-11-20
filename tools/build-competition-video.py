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

def render_slide(s,number):
    im=Image.new("RGB",(WIDTH,HEIGHT))
    px=im.load()
    # Deep-green wide gradient with visual texture and a light halo.
    for y in range(HEIGHT):
        for x in range(WIDTH):
            glow=max(0,1-math.hypot((x-1020)/900,(y-190)/620))
            stripe=2 if x%92==0 else 0
            px[x,y]=(int(8+glow*15)+stripe,int(30+glow*29)+stripe,int(25+glow*18)+stripe)
    d=ImageDraw.Draw(im)
    # Architectural lines and status rails.
    for x in range(660,WIDTH,100):d.line((x,0,x,HEIGHT),fill=(32,67,51),width=1)
    d.rounded_rectangle((45,38,1235,682),26,outline=(71,121,90),width=2)
    d.rounded_rectangle((73,62,112,101),12,fill=(184,237,125))
    d.text((85,65),"В",font=font(25,True),fill=(17,49,31))
    d.text((129,64),"ВОРОБЦІ",font=font(25,True),fill=(247,252,233))
    d.text((129,96),"ВЕКТОР ДОБРОЧЕСНОСТІ  •  ВІКНУ",font=font(12),fill=(166,206,176))
    d.text((84,156),s["tag"],font=font(17,True),fill=(187,238,138))
    # Keep title on the left and use large high-contrast type.
    y=210
    for ln in s["title"].split("\n"):
        d.text((82,y),ln,font=font(52,True),fill=(246,251,235),stroke_width=0)
        y+=68
    # Wrap the subheading to the left column.
    max_width=580
    words=s["sub"].split(" ")
    line=""
    sy=y+12
    for word in words:
        trial=(line+" "+word).strip()
        if d.textbbox((0,0),trial,font=font(19))[2]>max_width and line:
            d.text((84,sy),line,font=font(19),fill=(177,212,187));sy+=31;line=word
        else:line=trial
    if line:d.text((84,sy),line,font=font(19),fill=(177,212,187))
    # Big explanatory card, not invented real institutional scores.
    rr(d,(728,145,1198,575),26,(228,241,226))
    d.rounded_rectangle((754,169,1052,204),16,fill=(211,230,205))
    d.text((768,177),"INTEGRITY  •  ОГЛЯД",font=font(16,True),fill=(34,78,51))
    metric=s["metric"]
    size=84 if len(metric)<5 else 62
    d.text((765,224),metric,font=font(size,True),fill=(38,91,58))
    d.text((765,332),s["metric_label"],font=font(17,True),fill=(56,91,66))
    d.line((763,374,1162,374),fill=(169,204,174),width=2)
    for j,text in enumerate(s["lines"]):
        cy=403+j*48
        rr(d,(766,cy-3,790,cy+21),7,(52,118,77))
        d.text((774,cy-6),"✓",font=font(17,True),fill=(240,250,236))
        words=text
        f=font(15)
        while d.textbbox((0,0),words,font=f)[2]>355 and len(words)>4:
            words=words[:-2]
        if words!=text:words=words.rstrip()+"…"
        d.text((800,cy),words,font=f,fill=(44,79,53))
    # Dots and footer.
    for j in range(len(SCENES)):
        d.ellipse((82+j*27,628,91+j*27,637),fill=(184,235,125) if j==number else (65,109,77))
    d.text((973,622),f"{number+1:02d} / {len(SCENES):02d}",font=font(18,True),fill=(189,226,191))
    out=WORK/f"slide-{number:02}.png"
    im.save(out,optimize=True)
    return out

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
        # Gentle zoom/pan, separate audio tracks, dark cross-scene fades.
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
    if out.stat().st_size<100000 or out.stat().st_size>90000000:raise RuntimeError("Invalid final video size")
    seconds=ffprobe(out)
    if seconds<100 or seconds>230:raise RuntimeError(f"Unexpected video length: {seconds:.1f}s")
    print(f"VIDEO COMPLETE {out} | {seconds:.1f} sec | {out.stat().st_size/1024/1024:.1f} MiB | voice={VOICE}",flush=True)

if __name__=="__main__":
    asyncio.run(main())
