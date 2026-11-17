import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const db=new PGlite();
try {
 await db.exec(`CREATE TABLE subjects(id uuid PRIMARY KEY,name text NOT NULL);
 CREATE TABLE classes(id varchar(50) PRIMARY KEY);
 CREATE TABLE assessments(id uuid PRIMARY KEY,subject_id uuid REFERENCES subjects(id),first_ca integer);
 CREATE TABLE class_subjects(id uuid PRIMARY KEY,subject_id uuid REFERENCES subjects(id));
 INSERT INTO subjects VALUES ('00000000-0000-0000-0000-000000000001','Chemistry'),('00000000-0000-0000-0000-000000000002','CHEMISTRY');
 INSERT INTO assessments VALUES ('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001',0);`);
 for(const file of ["subject-merge-archive.sql","subject-duplicate-prevention.sql"])await db.exec(await readFile(new URL("../server/"+file,import.meta.url),"utf8"));
 await assert.rejects(db.exec("INSERT INTO subjects VALUES ('00000000-0000-0000-0000-000000000004',' chemistry ')"));
 assert.equal((await db.query("SELECT count(*)::int AS n FROM subjects")).rows[0].n,2);
 await db.exec("INSERT INTO subject_merge_snapshots(operation_id,actor_id,source_id,target_id,snapshot) VALUES ('00000000-0000-0000-0000-000000000005','test','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','{}')");
 assert.equal((await db.query("SELECT count(*)::int AS n FROM active_subjects")).rows[0].n,1);
 await assert.rejects(db.exec("INSERT INTO assessments VALUES ('00000000-0000-0000-0000-000000000006','00000000-0000-0000-0000-000000000002',10)"));
 assert.equal((await db.query("SELECT first_ca FROM assessments")).rows[0].first_ca,0);
 console.log("Isolated archive and duplicate migration smoke tests passed");
} finally {await db.close();}
