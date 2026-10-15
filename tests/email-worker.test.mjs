import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../email/Code.gs', import.meta.url), 'utf8');
const job = { id: 'test-id', email: 'qa@example.com', claim_token: 'test-claim', guests: [
 { name: '<Guest & One>', attending: true, events: ['haldi', 'wedding'] },
 { name: 'Guest Two', attending: false, events: [] },
] };
function worker({quota=100, failSend=false, failMark=false}={}) {
 const properties=new Map(), messages=[], calls=[];
 const context=vm.createContext({console:{log(){},error(){}},PropertiesService:{getScriptProperties:()=>({getProperty:key=>properties.get(key),setProperty:(key,value)=>properties.set(key,value)})},MailApp:{getRemainingDailyQuota:()=>quota,sendEmail:message=>{if(failSend)throw Error('test failure');messages.push(message);}},LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock(){}})}});
 vm.runInContext(source,context);
 context.weddingRpc_=(name,body)=>{calls.push({name,body});if(name.startsWith('claim_'))return [job];if(failMark)throw Error('network');return {ok:true};};
 return {context,messages,calls,properties};
}
test('confirmation includes escaped names, each guest choice and correct event locations',()=>{
 const {context}=worker();const message=context.weddingConfirmation_(job);
 assert.match(message.html,/&lt;Guest &amp; One&gt;/);assert.doesNotMatch(message.html,/<Guest & One>/);
 for(const label of ['Unable to attend','Haldi','Wedding &amp; lunch','Terrace Ballroom','Clubhouse Ballroom','Grand Ballroom','January 31, 2027','#SajNi'])assert.ok(message.html.includes(label),label);
 assert.match(message.text,/Guest Two: Unable to attend/);
});
test('confirmation includes the room-block next step in HTML and plain text',()=>{
 const {context}=worker();const message=context.weddingConfirmation_(job);
 assert.match(message.html, /href="https:\/\/book\.passkey\.com\/e\/51354114"[^>]*>Book your room<\/a>/);
 assert.match(message.text, /Next step: Book your stay[\s\S]*https:\/\/book\.passkey\.com\/e\/51354114/);
 assert.ok(message.html.indexOf('Book your room') < message.html.indexOf('Saturday, January 30'));
});
test('sends one message and records completion',()=>{
 const {context,messages,calls}=worker();context.sendWeddingConfirmations();
 assert.equal(messages.length,1);assert.equal(messages[0].to,'qa@example.com');
 assert.equal(calls.at(-1).body.p_success,true);
});
test('a database acknowledgement failure does not resend a recorded email',()=>{
 const {context,messages,properties}=worker({failMark:true});context.sendWeddingConfirmations();context.sendWeddingConfirmations();
 assert.equal(messages.length,1);assert.ok(properties.has('sent:test-id'));
});
test('failed mail remains retryable and is not marked sent',()=>{
 const {context,calls,properties}=worker({failSend:true});context.sendWeddingConfirmations();
 assert.equal(calls.at(-1).body.p_success,false);assert.equal(properties.has('sent:test-id'),false);
});
test('quota exhaustion leaves pending database replies untouched',()=>{
 const {context,messages,calls}=worker({quota:0});context.sendWeddingConfirmations();
 assert.equal(messages.length,0);assert.equal(calls.length,0);
});
