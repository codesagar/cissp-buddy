import test from 'node:test';
import assert from 'node:assert/strict';
import {releasePack} from '../lib/content/release-pack.ts';
import {validateRelease} from '../lib/content/validate.ts';
import {ancestors,descendants,visibleBranch,branchLayout,revealPath,hiddenRelationships} from '../lib/graph-model.ts';
import {emptyState,recordAnswer,advanceSession,validateBackup} from '../lib/study-state.ts';
const nodes=releasePack.nodes;
test('release validates all diagrams, article sections, taxonomy and question tags',()=>{const counts=validateRelease(releasePack);assert.equal(counts.concepts,97);assert.equal(counts.diagrams,20);assert.equal(counts.checks,30)});
test('every leaf is reachable by recursive expansion with stable coordinates',()=>{
 for(const root of nodes.filter(n=>!n.parentId)){
 const layout=branchLayout(nodes,root.id);assert.equal(layout.size,descendants(nodes,root.id).length+1);
 assert.deepEqual(visibleBranch(nodes,root.id,new Set()).map(n=>n.id),[root.id]);
 for(const leaf of nodes.filter(n=>n.rootConceptId===root.id&&!nodes.some(c=>c.parentId===n.id))){
 const path=ancestors(nodes,leaf.id);let expanded=new Set();
 for(const id of path){assert.ok(visibleBranch(nodes,root.id,expanded).some(n=>n.id===id));expanded.add(id)}
 assert.ok(visibleBranch(nodes,root.id,revealPath(nodes,leaf.id,new Set())).some(n=>n.id===leaf.id));
 assert.deepEqual(branchLayout(nodes,root.id),layout);
 expanded.delete(root.id);assert.equal(visibleBranch(nodes,root.id,expanded).length,1);
 }
 }
});
test('collapsed branches disclose relationships and retain original state',()=>{const expanded=new Set(['access-models']);const next=revealPath(nodes,'access-action-attributes',expanded);assert.equal(expanded.size,1);assert.ok(next.has('access-attributes'));assert.ok(hiddenRelationships(nodes,'access-models',new Set(['access-models'])).length>0)});
test('bad taxonomy, visual links and question links fail release validation',()=>{
 const mutate=[p=>p.nodes[1].parentId='absent',p=>p.nodes[1].parentId=p.nodes[1].id,p=>p.nodes[1].relatedIds.push('absent'),p=>p.questions[0].metadata.subtopicIds.push('absent'),p=>p.questions[0].metadata.learningLinks[0].sectionIndex=100,p=>p.lessons[0].design.blocks.find(b=>b.type==='diagram').links.push({from:'missing',to:'missing',label:'bad'})];
 for(const change of mutate){const pack=structuredClone(releasePack);change(pack);assert.throws(()=>validateRelease(pack))}
});
test('hinted success remains due and round-trips with immutable question evidence',()=>{
 const q=releasePack.questions[0],now=1788660000000;
 let state={...emptyState(),active:{id:'hint-test',questionIds:[q.id,releasePack.questions[1].id],index:0,phase:'answer',selected:q.correctIndex,guess:false,hintUsed:true,attemptId:null,elapsedMs:20,phaseMs:20,label:'Test'}};
 state=recordAnswer(state,q,now);assert.equal(state.attempts[0].hintUsed,true);assert.equal(state.reviews[q.conceptId].needsReview,true);assert.equal(state.attempts[0].contentRelease,releasePack.releaseId);assert.deepEqual(state.attempts[0].questionSnapshot.options,q.options);
 const copy=validateBackup(JSON.parse(JSON.stringify(state)),releasePack.lessons.map(l=>l.id),releasePack.questions);assert.deepEqual(copy,state);assert.equal(advanceSession(copy,now).active.hintUsed,false);
});
test('root lessons, source URLs, card IDs and labeled connections are release invariants',()=>{
 const mutations=[p=>p.lessons.pop(),p=>p.nodes[0].sourceUrls=['https://'],p=>p.lessons[0].design.cardVisual.items.push({...p.lessons[0].design.cardVisual.items[0]}),p=>p.lessons[0].design.cardVisual.connections=[{from:'missing',to:'missing',label:'bad'}]];
 for(const change of mutations){const p=structuredClone(releasePack);change(p);assert.throws(()=>validateRelease(p))}
});
test('exact subtopic and domain selection uses the same filtered pool as practice',async()=>{
 const {selectQuestions}=await import('../lib/study-state.ts');
 for(const node of nodes){const pool=releasePack.questions.filter(q=>q.metadata.subtopicIds.includes(node.id)&&q.metadata.domainId===node.domainId);const chosen=selectQuestions(pool,emptyState(),'mixed',undefined,0);assert.ok(chosen.every(q=>q.metadata.subtopicIds.includes(node.id)&&q.metadata.domainId===node.domainId));assert.equal(chosen.length,Math.min(4,pool.length))}
});
