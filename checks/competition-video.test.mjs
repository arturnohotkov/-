import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const ui=readFileSync(new URL('../public/live.js',import.meta.url),'utf8');
const page=readFileSync(new URL('../public/presentation.html',import.meta.url),'utf8');
const workflow=readFileSync(new URL('../.github/workflows/competition-video.yml',import.meta.url),'utf8');
const script=readFileSync(new URL('../tools/build-competition-video.py',import.meta.url),'utf8');
const doc=readFileSync(new URL('../README.md',import.meta.url),'utf8');

test('The home page and live survey introduction offer the same narrated MP4 BEFORE form start',()=>{
 const home=ui.slice(ui.indexOf('function landing(){'),ui.indexOf('function surveyIntro(){'));
 const survey=ui.slice(ui.indexOf('function surveyIntro(){'),ui.indexOf('function question(){'));
 assert.match(home,/class="welcomeVideo"/);
 assert.match(home,/vorobtsi-intro\.mp4/);
 assert.match(home,/vorobtsi-intro-poster\.jpg/);
 assert.match(survey,/class="surveyVideo"/);
 assert.match(survey,/vorobtsi-intro\.mp4/);
 assert.ok(survey.indexOf('vorobtsi-intro.mp4')<survey.indexOf('<form id="start">'));
 assert.match(survey,/Відео можна пропустити/);
});

test('The main competition presentation plays recorded Ukrainian audio rather than depending on local browser voices',()=>{
 assert.match(page,/class="featuredMovie"/);
 assert.match(page,/<video controls playsinline preload="metadata"/);
 assert.match(page,/vorobtsi-intro\.mp4/);
 assert.match(page,/у звукову доріжку відео/);
 assert.match(page,/Покадрова інтерактивна презентація/);
 assert.match(page,/muted=true/);
});

test('GitHub builds and publishes a real MP4 with an audio stream in the SAME repository',()=>{
 assert.match(workflow,/tools\/build-competition-video\.py/);
 assert.match(workflow,/uk-UA-PolinaNeural/);
 assert.match(workflow,/ffprobe.*-select_streams a:0/);
 assert.match(workflow,/gh-pages/);
 assert.match(script,/SCENES\s*=\s*\[/);
 assert.match(script,/font\(/);
 assert.match(script,/edge_tts\.Communicate/);
 assert.match(script,/"-c:a","aac"/);
 assert.match(doc,/воробці|Воробці/u);
 const demo=readFileSync(new URL('../offline/build-html.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(demo,/vorobtsi-intro/);
});

test('New MP4 has nine visually distinct original-deck-style scene mockups instead of repeated generic cards',()=>{
 assert.match(script,/def draw_visual\(d,kind\):/);
 for(let i=1;i<=7;i++)assert.match(script,new RegExp('elif kind=='+i+':'));
 assert.match(script,/draw_visual\(d,number\)/);
 assert.match(script,/Premium editorial slide system inspired by the original animated web deck/);
 assert.match(script,/ДИНАМІКА/);
 assert.match(script,/Часткове впровадження/);
});

test('Ukrainian narration marks dictionary stresses, corrects names and avoids unnatural English reading',()=>{
 assert.match(workflow,/ukrainian-word-stress/);
 assert.match(workflow,/marisa-trie/);
 assert.match(script,/from ukrainian_word_stress import Stressifier, StressSymbol, Disambiguation/);
 assert.match(script,/Disambiguation\.Dictionary/);
 assert.match(script,/"воробці":"воробці́"/u);
 assert.match(script,/"доброчесність":"доброче́сність"/u);
 assert.match(script,/"заходи":"за́ходи"/u);
 assert.match(script,/raw\.replace\("Integrity Management Dashboard","панель управління доброчесністю"\)/);
 assert.match(script,/pitch="\+0Hz"/);
});

test('All public MP4 players use refreshed video assets and offer closed captions',()=>{
 assert.match(workflow,/vorobtsi-intro\.uk\.vtt/);
 assert.match(script,/def write_captions/);
 const survey=ui.slice(ui.indexOf('function surveyIntro(){'),ui.indexOf('function question(){'));
 assert.match(survey,/vorobtsi-intro\.mp4\?v=2/);
 assert.match(survey,/vorobtsi-intro\.uk\.vtt\?v=2/);
 assert.match(page,/vorobtsi-intro\.mp4\?v=2/);
 assert.match(page,/vorobtsi-intro\.uk\.vtt\?v=2/);
 assert.match(page,/kind="captions"/);
});
