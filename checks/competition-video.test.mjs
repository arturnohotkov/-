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
