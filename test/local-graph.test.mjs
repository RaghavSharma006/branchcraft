import test from 'node:test';
import assert from 'node:assert/strict';
import {layout} from '../src/local-graph.mjs';
const commit=(hash,parents=[])=>({hash,parents,subject:hash,author:'Fixture',date:'2026-10-30',refs:''});
const repo=(commits,head,branches=[])=>({commits,head,current:'main',branches});
const branch=(name,hash,remote=false)=>({name,hash,remote});
function assertTopology(graph){
  const seen=new Set(),byHash=new Map(graph.nodes.map(n=>[n.hash,n]));
  for(const node of graph.nodes){
    assert.ok(!seen.has(`${node.x},${node.y}`),'nodes must not overlap');seen.add(`${node.x},${node.y}`);
    for(const parent of node.parents)if(byHash.has(parent))assert.ok(byHash.get(parent).x<node.x,'parent must be left of child');
    assert.ok(node.x<graph.width);assert.ok(node.y+104<graph.height);
  }
}
test('local graph preserves branch and merge topology independently of input order or dates',()=>{
  const commits=[commit('merge',['left','right']),commit('root'),commit('right',['root']),commit('left',['root'])];
  const input=repo(commits,'merge',[branch('feature','right'),branch('main','merge'),branch('origin/main','merge',true)]);
  const graph=layout(input);assertTopology(graph);
  assert.equal(graph.components,1);assert.equal(graph.incomplete,false);
  assert.equal(graph.nodes.find(n=>n.hash==='merge').lane,0);
  assert.equal(graph.nodes.find(n=>n.hash==='left').lane,0);
  assert.notEqual(graph.nodes.find(n=>n.hash==='right').lane,0);
  assert.deepEqual(graph.nodes.find(n=>n.hash==='merge').parents,['left','right']);
  assert.deepEqual(graph,layout({...input,commits:commits.slice().reverse(),branches:input.branches.slice().reverse()}));
});
test('disconnected histories use separate groups and align their roots without invented connections',()=>{
  const graph=layout(repo([commit('a'),commit('b',['a']),commit('x'),commit('y',['x'])],'b',[branch('main','b'),branch('master','y')]));
  assertTopology(graph);assert.equal(graph.components,2);
  const byHash=new Map(graph.nodes.map(n=>[n.hash,n]));
  assert.equal(byHash.get('a').x,byHash.get('x').x);
  assert.notEqual(byHash.get('a').component,byHash.get('x').component);
  assert.equal(byHash.get('b').component,byHash.get('a').component);
  assert.equal(byHash.get('b').lane,0);
});
test('detached, missing and empty histories retain boundaries and remain compact',()=>{
  const graph=layout(repo([commit('tip',['outside'])],'tip',[]));
  assertTopology(graph);assert.equal(graph.nodes[0].lane,0);assert.deepEqual(graph.nodes[0].missingParents,['outside']);assert.equal(graph.incomplete,true);
  const empty=layout(repo([],''));assert.equal(empty.nodes.length,0);assert.equal(empty.components,0);assert.equal(empty.width,600);assert.equal(empty.height,240);
});
test('stacked branch labels expand the lane and cyclic data is rejected',()=>{
  const graph=layout(repo([commit('a'),commit('b')],'a',[branch('main','a'),branch('alias','a'),branch('origin/main','a',true),branch('other','b')]));
  assertTopology(graph);assert.ok(graph.nodes[1].y-graph.nodes[0].y>=140);
  assert.throws(()=>layout(repo([commit('a',['b']),commit('b',['a'])],'a')),/cycle/);
});
test('switching branches preserves every node color and position, including shared tips',()=>{
 const input=repo([commit('a'),commit('b',['a']),commit('c',['a'])],'b',[branch('main','b'),branch('master','c'),branch('alias','b')]);
 const before=layout(input);
 for(const current of input.branches)assert.deepEqual(layout({...input,head:current.hash,current:current.name}),before);
 assert.deepEqual(layout({...input,head:'a',current:'Detached HEAD'}),before);
});
