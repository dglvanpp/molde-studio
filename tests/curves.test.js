import test from 'node:test';
import assert from 'node:assert/strict';
import {tracedDataToLoops} from '../src/trace-contours.js';

test('Long traced curves keep chord error below 0.10 pixels instead of using five flat segments',()=>{
  const [loop]=tracedDataToLoops({palette:[{r:0}],layers:[[{segments:[
    {type:'Q',x1:0,y1:0,x2:50,y2:100,x3:100,y3:0},
    {type:'L',x1:100,y1:0,x2:0,y2:0}
  ]}]]});
  assert.ok(loop.length>20);
  for(let i=1;i<loop.length;i++){
    const a=loop[i-1],b=loop[i],t=(a[0]+b[0])/200;
    const exactY=-200*t*(1-t),chordY=(a[1]+b[1])/2;
    assert.ok(Math.abs(exactY-chordY)<=.100001);
  }
  assert.deepEqual(loop[0],[0,-0]);assert.deepEqual(loop.at(-1),[100,-0]);
});
