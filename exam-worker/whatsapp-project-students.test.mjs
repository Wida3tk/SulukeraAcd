import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {whatsappProjectStudents} from './src/whatsapp-project-students.js';
test('minimal read-only roster includes eligible students and group members, deduplicated',async()=>{
 const db=new DatabaseSync(':memory:');
 db.exec("CREATE TABLE graduation_project_students(student_key TEXT,eligible INTEGER);CREATE TABLE graduation_project_group_members(student_key TEXT);INSERT INTO graduation_project_students VALUES ('a',1),('b',0),('c',1);INSERT INTO graduation_project_group_members VALUES ('a'),('member');CREATE TABLE grades(score INTEGER);INSERT INTO grades VALUES (40);");
 const sqls=[],env={DB:{prepare(sql){sqls.push(sql);return {all:async()=>({results:db.prepare(sql).all()})};}}};
 assert.deepEqual((await whatsappProjectStudents(env,{profile:{role:'admin'}})).studentKeys,['a','c','member']);
 assert.equal(sqls.length,1);assert.match(sqls[0],/^SELECT /);assert.equal(db.prepare('SELECT score FROM grades').get().score,40);db.close();
});
test('student, lecturer and finance cannot read the administrative roster',async()=>{
 for(const role of ['student','lecturer','finance'])await assert.rejects(whatsappProjectStudents({DB:{prepare(){throw Error('must not query')}}},{profile:{role}}),e=>e.message==='FORBIDDEN'&&e.status===403);
});
