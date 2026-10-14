import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';

import { getDbPool } from '@/lib/db';

export type TrainingOptionInput = { text: string; isCorrect: boolean };
export type TrainingQuestionInput = { text: string; points?: number; timeLimitSeconds?: number; maxSelections?: number; options: TrainingOptionInput[] };
export type TrainingTestInput = { categoryId: number; title: string; description?: string; passingScore: number; isPublished: boolean; questions: TrainingQuestionInput[] };

type IdRow = RowDataPacket & { id: number };

let schemaReady: Promise<void> | null = null;

export async function ensureTrainingTestsSchema(): Promise<void> {
  if (schemaReady) return schemaReady;
  schemaReady = (async () => {
    const pool = getDbPool();
    await pool.query(`CREATE TABLE IF NOT EXISTS training_test_categories (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(160) NOT NULL,
      description TEXT NULL,
      sort_order INT NOT NULL DEFAULT 0,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_training_category_title (title), KEY idx_training_category_visible (is_active, sort_order)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await pool.query(`CREATE TABLE IF NOT EXISTS training_tests (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      category_id BIGINT UNSIGNED NOT NULL,
      title VARCHAR(220) NOT NULL,
      description TEXT NULL,
      passing_score INT NOT NULL DEFAULT 0,
      is_published TINYINT(1) NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_training_test_category FOREIGN KEY (category_id) REFERENCES training_test_categories(id) ON DELETE RESTRICT,
      KEY idx_training_tests_visible (category_id, is_published)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await pool.query(`CREATE TABLE IF NOT EXISTS training_test_questions (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      test_id BIGINT UNSIGNED NOT NULL,
      question_text TEXT NOT NULL,
      points INT NOT NULL DEFAULT 1,
      time_limit_seconds INT NOT NULL DEFAULT 60,
      max_selections INT NOT NULL DEFAULT 1,
      sort_order INT NOT NULL DEFAULT 0,
      CONSTRAINT fk_training_question_test FOREIGN KEY (test_id) REFERENCES training_tests(id) ON DELETE CASCADE,
      KEY idx_training_questions_test (test_id, sort_order)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await pool.query(`CREATE TABLE IF NOT EXISTS training_test_options (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      question_id BIGINT UNSIGNED NOT NULL,
      option_text TEXT NOT NULL,
      is_correct TINYINT(1) NOT NULL DEFAULT 0,
      sort_order INT NOT NULL DEFAULT 0,
      CONSTRAINT fk_training_option_question FOREIGN KEY (question_id) REFERENCES training_test_questions(id) ON DELETE CASCADE,
      KEY idx_training_options_question (question_id, sort_order)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await pool.query(`CREATE TABLE IF NOT EXISTS training_test_attempts (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      test_id BIGINT UNSIGNED NOT NULL,
      user_id BIGINT UNSIGNED NOT NULL,
      status ENUM('in_progress','passed','failed','timed_out') NOT NULL DEFAULT 'in_progress',
      started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      finished_at DATETIME NULL,
      current_question_index INT NOT NULL DEFAULT 0,
      score INT NOT NULL DEFAULT 0,
      max_score INT NOT NULL DEFAULT 0,
      failure_reason VARCHAR(80) NULL,
      CONSTRAINT fk_training_attempt_test FOREIGN KEY (test_id) REFERENCES training_tests(id) ON DELETE RESTRICT,
      CONSTRAINT fk_training_attempt_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
      KEY idx_training_attempt_user (user_id, started_at), KEY idx_training_attempt_test (test_id, status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await pool.query(`CREATE TABLE IF NOT EXISTS training_test_attempt_answers (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      attempt_id BIGINT UNSIGNED NOT NULL,
      question_id BIGINT UNSIGNED NOT NULL,
      selected_option_ids JSON NULL,
      is_correct TINYINT(1) NOT NULL DEFAULT 0,
      points_awarded INT NOT NULL DEFAULT 0,
      answered_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_training_attempt_answer_attempt FOREIGN KEY (attempt_id) REFERENCES training_test_attempts(id) ON DELETE CASCADE,
      CONSTRAINT fk_training_attempt_answer_question FOREIGN KEY (question_id) REFERENCES training_test_questions(id) ON DELETE RESTRICT,
      UNIQUE KEY uq_training_attempt_question (attempt_id, question_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  })().catch((error) => { schemaReady = null; throw error; });
  return schemaReady;
}

function num(value: unknown, fallback = 0) { const n = Number(value); return Number.isFinite(n) ? Math.round(n) : fallback; }

export async function listTrainingCatalogForUser(userId: number) {
  await ensureTrainingTestsSchema();
  const [rows] = await getDbPool().query<RowDataPacket[]>(`
    SELECT c.id categoryId, c.title categoryTitle, c.description categoryDescription,
      t.id testId, t.title testTitle, t.description testDescription, t.passing_score passingScore,
      COUNT(DISTINCT q.id) questionCount,
      (SELECT COUNT(*) FROM training_test_attempts a WHERE a.test_id=t.id AND a.user_id=? ) attemptCount,
      (SELECT a.status FROM training_test_attempts a WHERE a.test_id=t.id AND a.user_id=? ORDER BY a.id DESC LIMIT 1) lastStatus
    FROM training_test_categories c JOIN training_tests t ON t.category_id=c.id
    LEFT JOIN training_test_questions q ON q.test_id=t.id
    WHERE c.is_active=1 AND t.is_published=1
    GROUP BY c.id,t.id ORDER BY c.sort_order,c.title,t.title`, [userId, userId]);
  return rows.map((r) => ({ categoryId: num(r.categoryId), categoryTitle: String(r.categoryTitle), categoryDescription: String(r.categoryDescription ?? ''), testId: num(r.testId), testTitle: String(r.testTitle), testDescription: String(r.testDescription ?? ''), passingScore: num(r.passingScore), questionCount: num(r.questionCount), attemptCount: num(r.attemptCount), lastStatus: r.lastStatus ? String(r.lastStatus) : null }));
}

export async function listTrainingAttemptsForUser(userId: number) {
  await ensureTrainingTestsSchema();
  const [rows] = await getDbPool().query<RowDataPacket[]>(`SELECT a.id,a.status,a.score,a.max_score,a.started_at,a.finished_at,a.failure_reason,t.title testTitle,c.title categoryTitle FROM training_test_attempts a JOIN training_tests t ON t.id=a.test_id JOIN training_test_categories c ON c.id=t.category_id WHERE a.user_id=? ORDER BY a.id DESC LIMIT 100`, [userId]);
  return rows.map((r) => ({ id:num(r.id), status:String(r.status), score:num(r.score), maxScore:num(r.max_score), startedAt:new Date(r.started_at).toISOString(), finishedAt:r.finished_at ? new Date(r.finished_at).toISOString() : null, failureReason:r.failure_reason ? String(r.failure_reason) : null, testTitle:String(r.testTitle), categoryTitle:String(r.categoryTitle) }));
}

async function questionsForTest(testId: number, includeAnswers: boolean) {
  const [questions] = await getDbPool().query<RowDataPacket[]>(`SELECT id,question_text,points,time_limit_seconds,max_selections,sort_order FROM training_test_questions WHERE test_id=? ORDER BY sort_order,id`, [testId]);
  if (!questions.length) return [];
  const ids = questions.map((q) => num(q.id));
  const [options] = await getDbPool().query<RowDataPacket[]>(`SELECT id,question_id,option_text,is_correct,sort_order FROM training_test_options WHERE question_id IN (${ids.map(() => '?').join(',')}) ORDER BY sort_order,id`, ids);
  return questions.map((q) => ({ id:num(q.id), text:String(q.question_text), points:num(q.points,1), timeLimitSeconds:num(q.time_limit_seconds,60), maxSelections:num(q.max_selections,1), options:options.filter((o) => num(o.question_id)===num(q.id)).map((o) => ({id:num(o.id),text:String(o.option_text),...(includeAnswers ? {isCorrect:num(o.is_correct)===1}: {})})) }));
}

export async function startTrainingAttempt(userId: number, testId: number) {
  await ensureTrainingTestsSchema();
  const pool = getDbPool();
  const [tests] = await pool.query<RowDataPacket[]>(`SELECT t.id,t.title,t.passing_score FROM training_tests t JOIN training_test_categories c ON c.id=t.category_id WHERE t.id=? AND t.is_published=1 AND c.is_active=1 LIMIT 1`, [testId]);
  if (!tests[0]) throw new Error('Тест недоступний.');
  const questions = await questionsForTest(testId, false);
  if (!questions.length) throw new Error('У тесті ще немає питань.');
  const maxScore = questions.reduce((sum, question) => sum + question.points, 0);
  const [created] = await pool.query<ResultSetHeader>(`INSERT INTO training_test_attempts (test_id,user_id,max_score) VALUES (?,?,?)`, [testId,userId,maxScore]);
  return { attemptId: created.insertId, title:String(tests[0].title), passingScore:num(tests[0].passing_score), maxScore, questions };
}

export async function answerTrainingAttempt(userId: number, attemptId: number, questionId: number, selectedOptionIds: number[]) {
  await ensureTrainingTestsSchema();
  const pool = getDbPool();
  const [attempts] = await pool.query<RowDataPacket[]>(`SELECT a.*,t.passing_score FROM training_test_attempts a JOIN training_tests t ON t.id=a.test_id WHERE a.id=? AND a.user_id=? LIMIT 1`,[attemptId,userId]);
  const attempt=attempts[0]; if (!attempt) throw new Error('Спробу не знайдено.');
  if (attempt.status !== 'in_progress') throw new Error('Ця спроба вже завершена.');
  const questions=await questionsForTest(num(attempt.test_id),true); const index=num(attempt.current_question_index); const question=questions[index];
  if (!question || question.id!==questionId) throw new Error('Неправильний порядок питань.');
  const elapsed=(Date.now()-new Date(attempt.started_at).getTime())/1000;
  const prior=questions.slice(0,index).reduce((sum,q)=>sum+q.timeLimitSeconds,0);
  if (elapsed>prior+question.timeLimitSeconds) { await pool.query(`UPDATE training_test_attempts SET status='timed_out',finished_at=UTC_TIMESTAMP(),failure_reason='time_limit_exceeded' WHERE id=?`,[attemptId]); return { finished:true,status:'timed_out',score:num(attempt.score),maxScore:num(attempt.max_score),reason:'Час на відповідь вичерпано.'}; }
  const validIds=new Set(question.options.map((o)=>o.id)); const selected=[...new Set(selectedOptionIds.map((id)=>num(id)).filter((id)=>validIds.has(id)))];
  if (selected.length>question.maxSelections) throw new Error(`Можна обрати не більше ${question.maxSelections} варіантів.`);
  const correctIds=question.options.filter((o)=>o.isCorrect).map((o)=>o.id).sort((a,b)=>a-b); const isCorrect=selected.sort((a,b)=>a-b).join(',')===correctIds.join(','); const awarded=isCorrect?question.points:0;
  await pool.query(`INSERT INTO training_test_attempt_answers (attempt_id,question_id,selected_option_ids,is_correct,points_awarded) VALUES (?,?,?,?,?)`,[attemptId,questionId,JSON.stringify(selected),isCorrect?1:0,awarded]);
  const score=num(attempt.score)+awarded; const next=index+1;
  if(next>=questions.length){const status=score>=num(attempt.passing_score)?'passed':'failed'; await pool.query(`UPDATE training_test_attempts SET status=?,finished_at=UTC_TIMESTAMP(),score=?,current_question_index=? WHERE id=?`,[status,score,next,attemptId]); return {finished:true,status,score,maxScore:num(attempt.max_score)};}
  await pool.query(`UPDATE training_test_attempts SET score=?,current_question_index=? WHERE id=?`,[score,next,attemptId]); return {finished:false,score,nextQuestion:questions[next]};
}

export async function listTrainingAdminData() { await ensureTrainingTestsSchema(); const pool=getDbPool(); const [categories]=await pool.query<RowDataPacket[]>('SELECT id,title,description,sort_order,is_active FROM training_test_categories ORDER BY sort_order,title'); const [tests]=await pool.query<RowDataPacket[]>('SELECT t.id,t.category_id,t.title,t.description,t.passing_score,t.is_published,COUNT(q.id) question_count FROM training_tests t LEFT JOIN training_test_questions q ON q.test_id=t.id GROUP BY t.id ORDER BY t.id DESC'); const [attempts]=await pool.query<RowDataPacket[]>('SELECT a.id,a.status,a.score,a.max_score,a.started_at,t.title testTitle,u.name,u.surname FROM training_test_attempts a JOIN training_tests t ON t.id=a.test_id JOIN users u ON u.id=a.user_id ORDER BY a.id DESC LIMIT 100'); return {categories:categories.map(r=>({id:num(r.id),title:String(r.title),description:String(r.description??''),sortOrder:num(r.sort_order),isActive:num(r.is_active)===1})),tests:tests.map(r=>({id:num(r.id),categoryId:num(r.category_id),title:String(r.title),description:String(r.description??''),passingScore:num(r.passing_score),isPublished:num(r.is_published)===1,questionCount:num(r.question_count)})),attempts:attempts.map(r=>({id:num(r.id),status:String(r.status),score:num(r.score),maxScore:num(r.max_score),startedAt:new Date(r.started_at).toISOString(),testTitle:String(r.testTitle),userName:`${r.surname??''} ${r.name??''}`.trim()}))}; }
export async function createTrainingCategory(input:{title:string;description?:string}) { await ensureTrainingTestsSchema(); const [r]=await getDbPool().query<ResultSetHeader>('INSERT INTO training_test_categories (title,description) VALUES (?,?)',[input.title.trim(),input.description?.trim()||null]); return r.insertId; }
export async function createTrainingTest(input:TrainingTestInput) { await ensureTrainingTestsSchema(); if(!input.title.trim()||!input.questions.length) throw new Error('Додайте назву і хоча б одне питання.'); const pool=getDbPool(); const connection=await pool.getConnection(); try {await connection.beginTransaction(); const [test]=await connection.query<ResultSetHeader>('INSERT INTO training_tests (category_id,title,description,passing_score,is_published) VALUES (?,?,?,?,?)',[input.categoryId,input.title.trim(),input.description?.trim()||null,Math.max(0,num(input.passingScore)),input.isPublished?1:0]); for(const [qi,q] of input.questions.entries()){const options=q.options.filter(o=>o.text.trim()); const correct=options.filter(o=>o.isCorrect).length; const max=Math.max(1,Math.min(num(q.maxSelections,correct||1),options.length)); if(options.length<2||!correct) throw new Error(`Питання ${qi+1} має містити щонайменше 2 варіанти й правильну відповідь.`); const [question]=await connection.query<ResultSetHeader>('INSERT INTO training_test_questions (test_id,question_text,points,time_limit_seconds,max_selections,sort_order) VALUES (?,?,?,?,?,?)',[test.insertId,q.text.trim(),Math.max(1,num(q.points,1)),Math.max(5,num(q.timeLimitSeconds,60)),max,qi]); for(const [oi,o] of options.entries())await connection.query('INSERT INTO training_test_options (question_id,option_text,is_correct,sort_order) VALUES (?,?,?,?)',[question.insertId,o.text.trim(),o.isCorrect?1:0,oi]);} await connection.commit(); return test.insertId;}catch(e){await connection.rollback();throw e;}finally{connection.release();} }
