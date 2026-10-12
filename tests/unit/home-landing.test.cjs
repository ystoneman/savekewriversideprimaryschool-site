const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const code = fs.readFileSync('home-stage.js','utf8');
const html = fs.readFileSync('index.html','utf8');
function state(at) {
  let now=at;const events={};let tick;
  const action={href:'council',textContent:'Check the council consultation',handlers:{},removeAttribute(){},replaceChildren(n){this.textContent=n.textContent},append(){},addEventListener:(type,fn)=>{events[type]=fn}};
  const note={textContent:''};const intro={textContent:'',replaceChildren(...nodes){this.textContent=nodes.map(n=>n.textContent).join('')}};
  class FakeDate extends Date {constructor(...args){super(...(args.length?args:[now]))}}
  const document={hidden:false,getElementById:id=>id==='main-action'?action:note,querySelector:()=>intro,createTextNode:textContent=>({textContent}),createElement:()=>({setAttribute(){}}),addEventListener:(type,fn)=>{events[type]=fn}};
  vm.runInNewContext(code,{Date:FakeDate,Intl,document,window:{addEventListener:(type,fn)=>{events[type]=fn}},setInterval:fn=>{tick=fn}});
  return {action,note,intro,document,events,advance:value=>{now=value},tick:()=>tick()};
}
test('current response goes directly to the official form',()=>{
 const s=state('2026-10-12T12:00:00Z');assert.match(s.action.href,/docs.google.com\/forms\/d\/e\/1FAIpQLSda5oPsdUlrJkf6vACC_AjvXFR6-ki3iBymNIF5BAWNxf85xQ\/viewform$/);assert.equal(s.action.textContent,'Respond to the council');assert.match(s.note.textContent,/16 October 2026/);assert.match(s.intro.textContent,/No final decision/);
});
test('London date boundary retains the response on 16 October',()=>{
 const s=state('2026-10-16T22:59:59Z');assert.match(s.action.href,/docs.google.com/);assert.equal(s.action.textContent,'Respond to the council');
});
test('London 17 October retires both response link and current-stage claim',()=>{
 const s=state('2026-10-16T23:00:00Z');assert.match(s.action.href,/www.richmond.gov.uk/);assert.equal(s.action.textContent,'Check the council consultation');assert.match(s.note.textContent,/has passed/);assert.match(s.intro.textContent,/On 12 October 2026/);assert.doesNotMatch(s.intro.textContent,/No final decision has/);
});
test('future dates never revive an expired response',()=>{const s=state('2027-09-01T12:00:00Z');assert.match(s.action.href,/www.richmond.gov.uk/);assert.match(s.note.textContent,/has passed/)});
test('without JavaScript the fallback stays dated and links current council information',()=>{
 assert.match(html,/<p class="intro">On 12 October 2026, Richmond Council was consulting on proposed closure/);assert.match(html,/id="main-action" href="https:\/\/www.richmond.gov.uk/);assert.doesNotMatch(html,/href="https:\/\/docs.google.com/);
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
