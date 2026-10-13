const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const code = fs.readFileSync('home-stage.js','utf8');
const html = fs.readFileSync('index.html','utf8');
function state(at) {
  let now=at;const events={};let tick;
  const action={href:'council',textContent:'Check the council consultation',handlers:{},removeAttribute(){},replaceChildren(n){this.textContent=n.textContent},append(){},addEventListener:(type,fn)=>{events[type]=fn}};
  const note={textContent:'',replaceChildren(...nodes){this.textContent=nodes.map(n=>n.textContent).join('')}};const intro={textContent:'',replaceChildren(...nodes){this.textContent=nodes.map(n=>n.textContent).join('')}};
  class FakeDate extends Date {constructor(...args){super(...(args.length?args:[now]))}}
  const petition={textContent:'',events:{},addEventListener(type,fn){this.events[type]=fn}};const petitionNote={textContent:''};
  const document={hidden:false,getElementById:id=>({'main-action':action,'action-note':note,'petition-action':petition,'petition-note':petitionNote}[id]||null),querySelector:()=>intro,createTextNode:textContent=>({textContent}),createElement:()=>({setAttribute(){}}),addEventListener:(type,fn)=>{events[type]=fn}};
  vm.runInNewContext(code,{Date:FakeDate,Intl,document,window:{addEventListener:(type,fn)=>{events[type]=fn}},setInterval:fn=>{tick=fn}});
  return {action,note,intro,petition,petitionNote,document,events,advance:value=>{now=value},tick:()=>tick()};
}
test('current response goes directly to the official form',()=>{
 const s=state('2026-10-12T12:00:00Z');assert.equal(s.action.hidden,false);assert.match(s.petitionNote.textContent,/does not replace your consultation response/);assert.match(s.action.href,/docs.google.com\/forms\/d\/e\/1FAIpQLSda5oPsdUlrJkf6vACC_AjvXFR6-ki3iBymNIF5BAWNxf85xQ\/viewform$/);assert.equal(s.action.textContent,'Respond to the council');assert.match(s.note.textContent,/16 October 2026/);assert.match(s.intro.textContent,/No final decision/);
});
test('London date boundary retains the response on 16 October',()=>{
 const s=state('2026-10-16T22:59:59Z');assert.match(s.action.href,/docs.google.com/);assert.equal(s.action.textContent,'Respond to the council');
});
test('London 17 October retires both response link and current-stage claim',()=>{
 const s=state('2026-10-16T23:00:00Z');assert.match(s.action.href,/www.richmond.gov.uk/);assert.equal(s.action.textContent,'Check the council consultation');assert.match(s.note.textContent,/has passed/);assert.match(s.intro.textContent,/16 October 2026, has passed/);assert.equal(s.action.hidden,true);assert.equal(s.note.hidden,true);assert.doesNotMatch(s.intro.textContent,/No final decision has/);
});
test('future dates never revive an expired response',()=>{const s=state('2027-09-01T12:00:00Z');assert.match(s.action.href,/www.richmond.gov.uk/);assert.match(s.note.textContent,/has passed/)});
test('without JavaScript the fallback stays dated and links current council information',()=>{
 assert.match(html,/<p class="intro">On 12 October 2026, Richmond Council was consulting on proposed closure/);assert.match(html,/id="main-action" href="https:\/\/www.richmond.gov.uk/);assert.doesNotMatch(html.match(/<a[^>]*id="main-action"[^>]*>/)[0],/docs.google.com/);
});
for (const event of ['visibilitychange','pageshow','click','auxclick','contextmenu','keydown','pointerdown']) {
 test('already-open page retires form through '+event,()=>{
  const s=state('2026-10-16T22:59:59Z');s.advance('2026-10-16T23:00:00Z');s.events[event]({type:event});
  if(event==='pointerdown'){assert.match(s.action.href,/www.richmond.gov.uk/);assert.equal(s.action.textContent,'Respond to the council');s.events.click({type:'click'});}
  assert.match(s.action.href,/www.richmond.gov.uk/);assert.equal(s.action.textContent,'Check the council consultation');assert.match(s.note.textContent,/has passed/);assert.doesNotMatch(s.intro.textContent,/No final decision has/);
 });
}
test('visible minute timer expires the full state; hidden timer waits for return',()=>{
 const s=state('2026-10-16T22:59:59Z');s.document.hidden=true;s.advance('2026-10-16T23:00:00Z');s.tick();assert.match(s.action.href,/docs.google.com/);s.document.hidden=false;s.events.visibilitychange();assert.match(s.action.href,/www.richmond.gov.uk/);s.tick();assert.match(s.action.href,/www.richmond.gov.uk/);
});
test('refresh is stable and can reset both directions',()=>{
 const s=state('2026-10-12T12:00:00Z');s.tick();assert.match(s.action.href,/docs.google.com/);s.advance('2026-10-17T12:00:00Z');s.tick();assert.match(s.action.href,/www.richmond.gov.uk/);s.advance('2026-10-15T12:00:00Z');s.events.pageshow();assert.equal(s.action.textContent,'Respond to the council');assert.match(s.action.href,/docs.google.com/);
});
for (const [at, label] of [
 ['2026-10-12T12:00:00Z', '4 days left'],
 ['2026-10-14T22:59:59Z', '2 days left'],
 ['2026-10-14T23:00:00Z', '1 day left'],
 ['2026-10-15T23:00:00Z', 'Closes today'],
]) test('London calendar countdown at '+at,()=>{
 const s=state(at);assert.equal(s.note.textContent,`${label} · Respond by 16 October 2026.`);
});
for (const event of ['visibilitychange','pageshow']) test('countdown updates within the active stage on '+event,()=>{
 const s=state('2026-10-12T22:59:59Z');s.advance('2026-10-12T23:00:00Z');s.events[event]();
 assert.equal(s.note.textContent,'3 days left · Respond by 16 October 2026.');
});
test('visible minute timer updates the countdown; hidden page waits for return',()=>{
 const s=state('2026-10-12T22:59:59Z');s.document.hidden=true;s.advance('2026-10-12T23:00:00Z');s.tick();
 assert.match(s.note.textContent,/4 days left/);s.document.hidden=false;s.tick();assert.match(s.note.textContent,/3 days left/);
});
test('countdown midnight refresh does not move a pressed target before click',()=>{
 const s=state('2026-10-15T22:59:59Z');s.advance('2026-10-15T23:00:00Z');s.events.pointerdown({type:'pointerdown'});
 assert.match(s.note.textContent,/1 day left/);assert.match(s.action.href,/docs.google.com/);
 s.events.click({type:'click'});assert.match(s.note.textContent,/Closes today/);
});

test('petition stays active after consultation closes and through its own final day',()=>{
 for(const at of ['2026-10-17T12:00:00Z','2027-01-13T23:59:59Z']){
  const s=state(at);assert.equal(s.petition.textContent,'Sign the petition');assert.match(s.petitionNote.textContent,/13 January 2027/);assert.match(s.action.href,/richmond.gov.uk/);
  // After the consultation closes the petition leads and drops the response reminder.
  assert.doesNotMatch(s.petitionNote.textContent,/does not replace/);assert.equal(s.action.hidden,true);
 }
});
test('petition retires independently on London 14 January, including an already open page',()=>{
 const s=state('2027-01-13T23:59:59Z');s.advance('2027-01-14T00:00:00Z');s.petition.events.click({type:'click'});
 assert.equal(s.petition.textContent,'View the petition');assert.match(s.petitionNote.textContent,/closing date.*has passed/);
});
