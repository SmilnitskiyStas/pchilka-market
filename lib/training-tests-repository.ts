import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';

import { getDbPool } from '@/lib/db';

export type TrainingOptionInput = { text: string; isCorrect: boolean };
export type TrainingQuestionInput = { text: string; points?: number; timeLimitSeconds?: number; maxSelections?: number; options: TrainingOptionInput[] };
export type TrainingTestInput = { categoryId: number; title: string; description?: string; passingScore: number; isPublished: boolean; questions?: TrainingQuestionInput[] };

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
      is_archived TINYINT(1) NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_training_test_category FOREIGN KEY (category_id) REFERENCES training_test_categories(id) ON DELETE RESTRICT,
      KEY idx_training_tests_visible (category_id, is_published)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    const [testColumns] = await pool.query<RowDataPacket[]>('SHOW COLUMNS FROM training_tests');
    if (!testColumns.some((column) => String(column.Field) === 'is_archived')) {
      await pool.query('ALTER TABLE training_tests ADD COLUMN is_archived TINYINT(1) NOT NULL DEFAULT 0 AFTER is_published');
    }
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
    WHERE c.is_active=1 AND t.is_published=1 AND t.is_archived=0
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
  const [tests] = await pool.query<RowDataPacket[]>(`SELECT t.id,t.title,t.passing_score FROM training_tests t JOIN training_test_categories c ON c.id=t.category_id WHERE t.id=? AND t.is_published=1 AND t.is_archived=0 AND c.is_active=1 LIMIT 1`, [testId]);
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
  const correctIds = new Set(question.options.filter((option) => option.isCorrect).map((option) => option.id));
  const selectedCorrectCount = selected.filter((optionId) => correctIds.has(optionId)).length;
  const selectedIncorrectCount = selected.length - selectedCorrectCount;
  const isCorrect = selectedIncorrectCount === 0 && selectedCorrectCount === correctIds.size;
  // Кожна правильна відповідь дає частину балу питання, а хибна віднімає таку саму частину.
  // Наприклад: 3 бали, 3 правильні відповіді, 2 правильні + 1 хибна = 1 бал.
  const netCorrectAnswers = Math.max(0, selectedCorrectCount - selectedIncorrectCount);
  const awarded = Math.round((netCorrectAnswers / correctIds.size) * question.points);
  await pool.query(`INSERT INTO training_test_attempt_answers (attempt_id,question_id,selected_option_ids,is_correct,points_awarded) VALUES (?,?,?,?,?)`,[attemptId,questionId,JSON.stringify(selected),isCorrect?1:0,awarded]);
  const score=num(attempt.score)+awarded; const next=index+1;
  if(next>=questions.length){const status=score>=num(attempt.passing_score)?'passed':'failed'; await pool.query(`UPDATE training_test_attempts SET status=?,finished_at=UTC_TIMESTAMP(),score=?,current_question_index=? WHERE id=?`,[status,score,next,attemptId]); return {finished:true,status,score,maxScore:num(attempt.max_score)};}
  await pool.query(`UPDATE training_test_attempts SET score=?,current_question_index=? WHERE id=?`,[score,next,attemptId]); return {finished:false,score,nextQuestion:questions[next]};
}

export async function listTrainingAdminData() { await ensureTrainingTestsSchema(); const pool=getDbPool(); const [categories]=await pool.query<RowDataPacket[]>('SELECT id,title,description,sort_order,is_active FROM training_test_categories ORDER BY sort_order,title'); const [tests]=await pool.query<RowDataPacket[]>(`SELECT t.id,t.category_id,t.title,t.description,t.passing_score,t.is_published,t.is_archived,COUNT(DISTINCT q.id) question_count,COUNT(DISTINCT a.id) attempt_count FROM training_tests t LEFT JOIN training_test_questions q ON q.test_id=t.id LEFT JOIN training_test_attempts a ON a.test_id=t.id GROUP BY t.id ORDER BY t.is_archived,t.id DESC`); const [attempts]=await pool.query<RowDataPacket[]>('SELECT a.id,a.status,a.score,a.max_score,a.started_at,t.title testTitle,u.name,u.surname FROM training_test_attempts a JOIN training_tests t ON t.id=a.test_id JOIN users u ON u.id=a.user_id ORDER BY a.id DESC LIMIT 100'); return {categories:categories.map(r=>({id:num(r.id),title:String(r.title),description:String(r.description??''),sortOrder:num(r.sort_order),isActive:num(r.is_active)===1})),tests:tests.map(r=>({id:num(r.id),categoryId:num(r.category_id),title:String(r.title),description:String(r.description??''),passingScore:num(r.passing_score),isPublished:num(r.is_published)===1,isArchived:num(r.is_archived)===1,questionCount:num(r.question_count),attemptCount:num(r.attempt_count)})),attempts:attempts.map(r=>({id:num(r.id),status:String(r.status),score:num(r.score),maxScore:num(r.max_score),startedAt:new Date(r.started_at).toISOString(),testTitle:String(r.testTitle),userName:`${r.surname??''} ${r.name??''}`.trim()}))}; }
export async function createTrainingCategory(input:{title:string;description?:string}) { await ensureTrainingTestsSchema(); const [r]=await getDbPool().query<ResultSetHeader>('INSERT INTO training_test_categories (title,description) VALUES (?,?)',[input.title.trim(),input.description?.trim()||null]); return r.insertId; }
async function insertQuestions(connection: PoolConnection, testId: number, questions: TrainingQuestionInput[]) {
  if (!questions.length) throw new Error('Додайте хоча б одне питання.');
  for (const [qi, question] of questions.entries()) {
    if (!question.text.trim()) throw new Error(`Вкажіть текст питання ${qi + 1}.`);
    const options = question.options.filter((option) => option.text.trim());
    const correct = options.filter((option) => option.isCorrect).length;
    if (options.length < 2 || !correct) throw new Error(`Питання ${qi + 1} має містити щонайменше 2 варіанти й правильну відповідь.`);
    const max = Math.max(1, Math.min(num(question.maxSelections, correct), options.length));
    const [created] = await connection.query<ResultSetHeader>('INSERT INTO training_test_questions (test_id,question_text,points,time_limit_seconds,max_selections,sort_order) VALUES (?,?,?,?,?,?)', [testId, question.text.trim(), Math.max(1, num(question.points, 1)), Math.max(5, num(question.timeLimitSeconds, 60)), max, qi]);
    for (const [oi, option] of options.entries()) await connection.query('INSERT INTO training_test_options (question_id,option_text,is_correct,sort_order) VALUES (?,?,?,?)', [created.insertId, option.text.trim(), option.isCorrect ? 1 : 0, oi]);
  }
}

export async function createTrainingTest(input: TrainingTestInput) { await ensureTrainingTestsSchema(); if (!input.title.trim() || !input.questions) throw new Error('Додайте назву і хоча б одне питання.'); const pool = getDbPool(); const connection = await pool.getConnection(); try { await connection.beginTransaction(); const [test] = await connection.query<ResultSetHeader>('INSERT INTO training_tests (category_id,title,description,passing_score,is_published) VALUES (?,?,?,?,?)', [input.categoryId, input.title.trim(), input.description?.trim() || null, Math.max(0, num(input.passingScore)), input.isPublished ? 1 : 0]); await insertQuestions(connection, test.insertId, input.questions); await connection.commit(); return test.insertId; } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); } }

export async function getTrainingTestForAdmin(testId: number) { await ensureTrainingTestsSchema(); const pool = getDbPool(); const [tests] = await pool.query<RowDataPacket[]>(`SELECT t.id,t.category_id,t.title,t.description,t.passing_score,t.is_published,t.is_archived,(SELECT COUNT(*) FROM training_test_attempts a WHERE a.test_id=t.id) attempt_count FROM training_tests t WHERE t.id=? LIMIT 1`, [testId]); const test = tests[0]; if (!test) throw new Error('Тест не знайдено.'); return { id:num(test.id), categoryId:num(test.category_id), title:String(test.title), description:String(test.description ?? ''), passingScore:num(test.passing_score), isPublished:num(test.is_published) === 1, isArchived:num(test.is_archived) === 1, attemptCount:num(test.attempt_count), questions:await questionsForTest(testId, true) }; }

export async function updateTrainingTest(testId: number, input: TrainingTestInput) { await ensureTrainingTestsSchema(); if (!input.title.trim()) throw new Error('Вкажіть назву тесту.'); const pool = getDbPool(); const connection = await pool.getConnection(); try { await connection.beginTransaction(); const [tests] = await connection.query<RowDataPacket[]>('SELECT id,is_archived FROM training_tests WHERE id=? FOR UPDATE', [testId]); if (!tests[0]) throw new Error('Тест не знайдено.'); if (num(tests[0].is_archived) === 1) throw new Error('Спершу відновіть тест з архіву.'); const [attempts] = await connection.query<RowDataPacket[]>('SELECT COUNT(*) count FROM training_test_attempts WHERE test_id=?', [testId]); const hasAttempts = num(attempts[0]?.count) > 0; if (hasAttempts && input.questions) throw new Error('Питання тесту зі спробами працівників змінювати не можна.'); await connection.query('UPDATE training_tests SET category_id=?,title=?,description=?,passing_score=?,is_published=? WHERE id=?', [input.categoryId, input.title.trim(), input.description?.trim() || null, Math.max(0, num(input.passingScore)), input.isPublished ? 1 : 0, testId]); if (input.questions) { await connection.query('DELETE FROM training_test_questions WHERE test_id=?', [testId]); await insertQuestions(connection, testId, input.questions); } await connection.commit(); } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); } }

export async function setTrainingTestPublished(testId: number, isPublished: boolean) { await ensureTrainingTestsSchema(); const [result] = await getDbPool().query<ResultSetHeader>('UPDATE training_tests SET is_published=? WHERE id=? AND is_archived=0', [isPublished ? 1 : 0, testId]); if (!result.affectedRows) throw new Error('Тест не знайдено або він в архіві.'); }
export async function archiveTrainingTest(testId: number) { await ensureTrainingTestsSchema(); const [result] = await getDbPool().query<ResultSetHeader>('UPDATE training_tests SET is_archived=1,is_published=0 WHERE id=?', [testId]); if (!result.affectedRows) throw new Error('Тест не знайдено.'); }
export async function restoreTrainingTest(testId: number) { await ensureTrainingTestsSchema(); const [result] = await getDbPool().query<ResultSetHeader>('UPDATE training_tests SET is_archived=0 WHERE id=?', [testId]); if (!result.affectedRows) throw new Error('Тест не знайдено.'); }
export async function deleteTrainingTest(testId: number) { await ensureTrainingTestsSchema(); const pool = getDbPool(); const [attempts] = await pool.query<RowDataPacket[]>('SELECT COUNT(*) count FROM training_test_attempts WHERE test_id=?', [testId]); if (num(attempts[0]?.count) > 0) throw new Error('Тест має спроби працівників — перемістіть його в архів.'); const [result] = await pool.query<ResultSetHeader>('DELETE FROM training_tests WHERE id=?', [testId]); if (!result.affectedRows) throw new Error('Тест не знайдено.'); }
