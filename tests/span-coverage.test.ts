import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SpanCoverage} from '../src/fleet/span-coverage';
test('span completion requires full traversal and processing delay',()=>{
 const c=new SpanCoverage();c.observe(0,200,400,0,0);assert.equal(c.complete(0,100),false);
 for(let x=0;x<=400;x+=5)c.observe(0,x,400,0,x);
 assert.equal(c.complete(0,390),false);assert.equal(c.complete(0,403),true);
 c.clear();assert.equal(c.complete(0,1000),false);
});
test('coverage supports reverse traversal but never fills unflown gaps or distant passes',()=>{
 const c=new SpanCoverage();for(let x=400;x>=0;x-=5)c.observe(0,x,400,80,400-x);
 assert.equal(c.complete(0,1000),false);
 c.observe(0,0,400,0,0);c.observe(0,400,400,0,1);assert.equal(c.complete(0,1000),false);
 for(let x=400;x>=0;x-=5)c.observe(0,x,400,0,400-x);
 assert.equal(c.complete(0,403),true);
});
