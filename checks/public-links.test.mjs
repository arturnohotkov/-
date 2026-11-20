import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('Manager shares only the public GitHub Pages survey link, never the back-end address',()=>{
 const client=readFileSync(new URL('../public/live.js',import.meta.url),'utf8');
 assert.match(client,/const publicSite='https:\/\/arturnohotkov\.github\.io\/-\//);
 assert.match(client,/const publicSurvey=publicSite\+'survey\/'/);
 assert.match(client,/id="survey-link" href="\$\{publicSurvey\}"/);
 assert.match(client,/link\.href/); // Copy button sends the same canonical URL.
 assert.doesNotMatch(client,/id="survey-link" href="\$\{link\('\/survey'\)\}"/);
});
test('GitHub Pages advertises canonical clean public links for main, manager and survey',()=>{
 const build=readFileSync(new URL('../offline/build-pages.mjs',import.meta.url),'utf8');
 assert.match(build,/rel="canonical"/);
 assert.match(build,/property="og:url"/);
 assert.match(build,/arturnohotkov\.github\.io/);
 assert.match(build,/canonical=publicBase\+\(section\?section\+'\/'\:''\)/);
});
test('No attempt to delete backend URL or overwrite anonymous survey storage',()=>{
 const client=readFileSync(new URL('../public/live.js',import.meta.url),'utf8');
 assert.match(client,/fetch\(backend\+'\/api\/v1\/live-'\+name,options\)/);
 assert.match(client,/const ballotKey='vektor-ballot:'/);
 const demo=readFileSync(new URL('../offline/build-html.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(demo,/publicSurvey/);
});
