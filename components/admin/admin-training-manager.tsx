'use client';

import { useEffect, useState } from 'react';

type Option = { text: string; isCorrect: boolean };
type Question = { text: string; points: number; timeLimitSeconds: number; maxSelections: number; options: Option[] };
type Category = { id: number; title: string };
type TestCard = { id: number; categoryId: number; title: string; description: string; passingScore: number; isPublished: boolean; isArchived: boolean; questionCount: number; attemptCount: number };
type TestDetails = TestCard & { questions: Question[] };
type AttemptAnswer = { questionText: string; questionPoints: number; pointsAwarded: number; isFullyCorrect: boolean; options: Array<{ text: string; isCorrect: boolean; isSelected: boolean }> };
type TestStatistics = { test: { id: number; title: string; passingScore: number }; totals: { total: number; passed: number; failed: number; timedOut: number; inProgress: number }; attempts: Array<{ id: number; userId: number; userName: string; status: string; score: number; maxScore: number; startedAt: string; finishedAt: string | null; failureReason: string | null; answers: AttemptAnswer[] }> };

const blankQuestion = (): Question => ({ text: '', points: 1, timeLimitSeconds: 60, maxSelections: 1, options: [{ text: '', isCorrect: true }, { text: '', isCorrect: false }] });
const initialData = { categories: [] as Category[], tests: [] as TestCard[], attempts: [] as Array<{ id: number; userName: string; testTitle: string; score: number; maxScore: number; status: string }> };

export default function AdminTrainingManager() {
  const [data, setData] = useState(initialData);
  const [category, setCategory] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [passingScore, setPassingScore] = useState(1);
  const [isPublished, setIsPublished] = useState(true);
  const [questions, setQuestions] = useState<Question[]>([blankQuestion()]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingHasAttempts, setEditingHasAttempts] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [categoryTests, setCategoryTests] = useState<TestDetails[]>([]);
  const [statistics, setStatistics] = useState<TestStatistics | null>(null);
  const [selectedStatisticsUserId, setSelectedStatisticsUserId] = useState<number | null>(null);
  const [selectedStatisticsAttemptId, setSelectedStatisticsAttemptId] = useState<number | null>(null);
  const [testSearch, setTestSearch] = useState('');
  const [testStatusFilter, setTestStatusFilter] = useState<'all' | 'published' | 'hidden'>('all');
  const [testsPage, setTestsPage] = useState(1);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const response = await fetch('/api/admin/training', { cache: 'no-store' });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? 'Не вдалося завантажити дані.');
    setData({ categories: result.categories ?? [], tests: result.tests ?? [], attempts: result.attempts ?? [] });
  };

  useEffect(() => { void load().catch((error) => setNotice(error.message)); }, []);

  function resetForm() { setEditingId(null); setEditingHasAttempts(false); setCategoryId(''); setTitle(''); setDescription(''); setPassingScore(1); setIsPublished(true); setQuestions([blankQuestion()]); }
  function setQuestion(index: number, patch: Partial<Question>) { setQuestions((all) => all.map((question, current) => current === index ? { ...question, ...patch } : question)); }
  function setOption(questionIndex: number, optionIndex: number, patch: Partial<Option>) { setQuestions((all) => all.map((question, current) => current === questionIndex ? { ...question, options: question.options.map((option, optionCurrent) => optionCurrent === optionIndex ? { ...option, ...patch } : option) } : question)); }

  async function addCategory(event: React.FormEvent) {
    event.preventDefault(); setBusy(true);
    try { const response = await fetch('/api/admin/training', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'category', category: { title: category } }) }); const result = await response.json(); if (!response.ok) throw new Error(result.error); setCategory(''); setNotice('Категорію створено.'); await load(); }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Помилка.'); } finally { setBusy(false); }
  }

  async function openEdit(testId: number) {
    setBusy(true);
    try { const response = await fetch(`/api/admin/training?testId=${testId}`, { cache: 'no-store' }); const result = await response.json(); if (!response.ok) throw new Error(result.error); const test = result.test as TestDetails; setEditingId(test.id); setEditingHasAttempts(test.attemptCount > 0); setCategoryId(String(test.categoryId)); setTitle(test.title); setDescription(test.description); setPassingScore(test.passingScore); setIsPublished(test.isPublished); setQuestions(test.questions); setNotice(test.attemptCount > 0 ? 'Цей тест уже має спроби: можна змінити лише основні дані, щоб зберегти історію результатів.' : 'Дані тесту завантажено для редагування.'); }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Помилка.'); } finally { setBusy(false); }
  }

  async function openCategory(categoryIdValue: number) {
    setSelectedCategoryId(categoryIdValue); setBusy(true);
    try {
      const tests = data.tests.filter((test) => test.categoryId === categoryIdValue);
      const details = await Promise.all(tests.map(async (test) => {
        const response = await fetch(`/api/admin/training?testId=${test.id}`, { cache: 'no-store' });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        return result.test as TestDetails;
      }));
      setCategoryTests(details);
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Помилка.'); } finally { setBusy(false); }
  }

  async function openStatistics(testId: number) {
    setBusy(true);
    try { const response = await fetch(`/api/admin/training?statisticsTestId=${testId}`, { cache: 'no-store' }); const result = await response.json(); if (!response.ok) throw new Error(result.error); setStatistics(result.statistics as TestStatistics); setSelectedStatisticsUserId(null); setSelectedStatisticsAttemptId(null); }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Помилка.'); } finally { setBusy(false); }
  }

  async function saveTest(event: React.FormEvent) {
    event.preventDefault(); setBusy(true);
    try { const test = { categoryId: Number(categoryId), title, description, passingScore: Number(passingScore), isPublished, ...(editingHasAttempts ? {} : { questions }) }; const response = await fetch('/api/admin/training', { method: editingId ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editingId ? { action: 'update', testId: editingId, test } : { action: 'test', test }) }); const result = await response.json(); if (!response.ok) throw new Error(result.error); setNotice(editingId ? 'Зміни тесту збережено.' : 'Тест створено.'); resetForm(); await load(); }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Помилка.'); } finally { setBusy(false); }
  }

  async function testAction(action: 'set-published' | 'archive' | 'restore' | 'delete', test: TestCard, isPublishedValue?: boolean) {
    const confirmation = action === 'archive' ? `Перемістити тест «${test.title}» в архів? Працівники більше не бачитимуть його.` : action === 'delete' ? `Остаточно видалити тест «${test.title}»? Цю дію неможливо скасувати.` : '';
    if (confirmation && !window.confirm(confirmation)) return;
    setBusy(true);
    try { const response = await fetch('/api/admin/training', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, testId: test.id, isPublished: isPublishedValue }) }); const result = await response.json(); if (!response.ok) throw new Error(result.error); setNotice(action === 'archive' ? 'Тест переміщено в архів.' : action === 'restore' ? 'Тест відновлено з архіву.' : action === 'delete' ? 'Тест видалено.' : isPublishedValue ? 'Тест опубліковано.' : 'Тест приховано від працівників.'); if (editingId === test.id && action !== 'set-published') resetForm(); await load(); }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Помилка.'); } finally { setBusy(false); }
  }

  const visibleTests = data.tests.filter((test) => !test.isArchived);
  const archivedTests = data.tests.filter((test) => test.isArchived);
  const filteredTests = visibleTests.filter((test) => {
    const matchesSearch = test.title.toLocaleLowerCase('uk-UA').includes(testSearch.trim().toLocaleLowerCase('uk-UA'));
    const matchesStatus = testStatusFilter === 'all' || (testStatusFilter === 'published' ? test.isPublished : !test.isPublished);
    return matchesSearch && matchesStatus;
  });
  const testsPerPage = 10;
  const testsPageCount = Math.max(1, Math.ceil(filteredTests.length / testsPerPage));
  const activeTestsPage = Math.min(testsPage, testsPageCount);
  const pagedTests = filteredTests.slice((activeTestsPage - 1) * testsPerPage, activeTestsPage * testsPerPage);
  const questionControlsDisabled = editingHasAttempts;

  const selectedCategory = data.categories.find((item) => item.id === selectedCategoryId);
  const statisticsUsers = statistics ? [...new Map(statistics.attempts.map((attempt) => [attempt.userId, { id: attempt.userId, name: attempt.userName }])).values()] : [];
  const selectedUserAttempts = statistics && selectedStatisticsUserId !== null ? statistics.attempts.filter((attempt) => attempt.userId === selectedStatisticsUserId) : [];
  const selectedStatisticsAttempt = selectedUserAttempts.find((attempt) => attempt.id === selectedStatisticsAttemptId) ?? null;

  return <div className="w-full max-w-none">
    <p className="text-xs font-bold uppercase tracking-[.18em] text-brand">Навчання</p><h1 className="mt-2 text-2xl font-bold text-slate-900">Тести для працівників</h1>
    {notice && <p className="mt-4 rounded-xl bg-slate-100 p-3 text-sm text-slate-700">{notice}</p>}
    <div className="mt-6 grid gap-6 lg:grid-cols-3"><form onSubmit={addCategory} className="rounded-2xl border border-slate-200 p-4"><h2 className="font-bold">Нова категорія</h2><input required value={category} onChange={(event) => setCategory(event.target.value)} placeholder="Наприклад, Каса" className="mt-3 w-full rounded-xl border p-2" /><button disabled={busy} className="mt-3 rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white">Додати</button><div className="mt-4 space-y-1 text-sm text-slate-600">{data.categories.map((item) => <button type="button" key={item.id} disabled={busy} onClick={() => void openCategory(item.id)} className={`block w-full rounded-lg px-2 py-1 text-left font-semibold hover:bg-slate-100 ${selectedCategoryId === item.id ? 'bg-brand/10 text-brand' : ''}`}>{item.title}</button>)}</div></form>
      <section className="rounded-2xl border border-slate-200 p-4 lg:col-span-2"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-bold">Тести</h2><span className="text-sm text-slate-500">{filteredTests.length} тестів</span></div><div className="mt-3 flex flex-wrap gap-2"><input value={testSearch} onChange={(event) => { setTestSearch(event.target.value); setTestsPage(1); }} placeholder="Пошук за назвою" className="min-w-48 flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm" /><select value={testStatusFilter} onChange={(event) => { setTestStatusFilter(event.target.value as 'all' | 'published' | 'hidden'); setTestsPage(1); }} className="rounded-xl border border-slate-300 px-3 py-2 text-sm"><option value="all">Усі статуси</option><option value="published">Видимі</option><option value="hidden">Приховані</option></select></div><div className="mt-3 overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="border-b border-slate-200 text-xs text-slate-500"><tr><th className="px-2 py-2">Тест</th><th className="px-2 py-2">Питань</th><th className="px-2 py-2">Спроб</th><th className="px-2 py-2">Статус</th><th className="px-2 py-2 text-right">Дії</th></tr></thead><tbody>{pagedTests.map((test) => <tr key={test.id} className="border-b border-slate-100"><td className="max-w-64 px-2 py-3 font-semibold text-slate-900">{test.title}</td><td className="px-2 py-3">{test.questionCount}</td><td className="px-2 py-3">{test.attemptCount}</td><td className={`px-2 py-3 font-medium ${test.isPublished ? 'text-brand' : 'text-slate-500'}`}>{test.isPublished ? 'Видимий' : 'Прихований'}</td><td className="px-2 py-3"><div className="flex justify-end gap-1"><button type="button" disabled={busy} onClick={() => void openStatistics(test.id)} className="rounded border border-sky-400 px-2 py-1 text-xs font-semibold text-sky-800">Статистика</button><button type="button" disabled={busy} onClick={() => void openEdit(test.id)} className="rounded border border-slate-300 px-2 py-1 text-xs font-semibold">Редагувати</button><button type="button" disabled={busy} onClick={() => void testAction('set-published', test, !test.isPublished)} className="rounded border border-brand px-2 py-1 text-xs font-semibold text-brand">{test.isPublished ? 'Приховати' : 'Опублікувати'}</button><button type="button" disabled={busy} onClick={() => void testAction('archive', test)} className="rounded border border-amber-500 px-2 py-1 text-xs font-semibold text-amber-700">В архів</button>{test.attemptCount === 0 && <button type="button" disabled={busy} onClick={() => void testAction('delete', test)} className="rounded border border-red-300 px-2 py-1 text-xs font-semibold text-red-700">Видалити</button>}</div></td></tr>)}</tbody></table>{filteredTests.length === 0 && <p className="py-5 text-center text-sm text-slate-500">Тестів за цими умовами не знайдено.</p>}</div>{filteredTests.length > testsPerPage && <div className="mt-4 flex items-center justify-between text-sm text-slate-600"><span>Сторінка {activeTestsPage} з {testsPageCount}</span><div className="flex gap-2"><button type="button" disabled={activeTestsPage === 1} onClick={() => setTestsPage(activeTestsPage - 1)} className="rounded border border-slate-300 px-3 py-1 disabled:opacity-40">Назад</button><button type="button" disabled={activeTestsPage === testsPageCount} onClick={() => setTestsPage(activeTestsPage + 1)} className="rounded border border-slate-300 px-3 py-1 disabled:opacity-40">Далі</button></div></div>}</section></div>
    {statistics && <section className="mt-6 rounded-2xl border border-sky-200 bg-sky-50/40 p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-bold">Відповіді працівників: {statistics.test.title}</h2><p className="mt-1 text-sm text-slate-600">Оберіть працівника, а потім конкретну спробу.</p></div><button type="button" onClick={() => { setStatistics(null); setSelectedStatisticsUserId(null); setSelectedStatisticsAttemptId(null); }} className="text-sm font-semibold text-slate-600">Закрити</button></div><div className="mt-4 flex flex-wrap gap-2">{statisticsUsers.length === 0 && <p className="text-sm text-slate-500">Спроб ще немає.</p>}{statisticsUsers.map((user) => <button type="button" key={user.id} onClick={() => { setSelectedStatisticsUserId(user.id); setSelectedStatisticsAttemptId(null); }} className={`rounded-xl border px-4 py-2 text-sm font-semibold ${selectedStatisticsUserId === user.id ? 'border-brand bg-brand/10 text-brand' : 'border-slate-300 bg-white text-slate-800'}`}>{user.name || 'Працівник'}</button>)}</div>{selectedStatisticsUserId !== null && <div className="mt-5"><p className="text-sm font-semibold text-slate-700">Спроби</p><div className="mt-2 flex flex-wrap gap-2">{selectedUserAttempts.map((attempt) => <button type="button" key={attempt.id} onClick={() => setSelectedStatisticsAttemptId(attempt.id)} className={`rounded-xl border px-4 py-2 text-sm ${selectedStatisticsAttemptId === attempt.id ? 'border-brand bg-brand/10 text-brand' : 'border-slate-300 bg-white text-slate-800'}`}>Спроба від {new Date(attempt.startedAt).toLocaleString('uk-UA')}</button>)}</div></div>}{selectedStatisticsAttempt && <article className="mt-5 rounded-xl border border-slate-200 bg-white p-4">{selectedStatisticsAttempt.failureReason && <p className="text-sm text-red-700">{selectedStatisticsAttempt.failureReason}</p>}<div className="mt-4 space-y-3">{selectedStatisticsAttempt.answers.length === 0 && <p className="text-sm text-slate-500">Працівник ще не надав відповідей.</p>}{selectedStatisticsAttempt.answers.map((answer, answerIndex) => <div key={answerIndex} className="rounded-lg bg-slate-50 p-3"><p className="font-semibold">{answerIndex + 1}. {answer.questionText}</p><p className="mt-1 text-xs text-slate-600">Отримано {answer.pointsAwarded}/{answer.questionPoints} балів</p><ul className="mt-2 space-y-1 text-sm">{answer.options.map((option, optionIndex) => <li key={optionIndex} className={option.isSelected ? (option.isCorrect ? 'font-semibold text-green-700' : 'font-semibold text-red-700') : option.isCorrect ? 'text-brand' : 'text-slate-500'}>{option.isSelected ? '✓' : '○'} {option.text}{option.isCorrect && ' — правильна'}</li>)}</ul></div>)}</div></article>}</section>}
    {selectedCategory && <section className="mt-6 rounded-2xl border border-slate-200 p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-bold">Питання категорії: {selectedCategory.title}</h2><p className="mt-1 text-sm text-slate-600">Тести й питання, які вже створені в цій категорії.</p></div><button type="button" onClick={() => { setSelectedCategoryId(null); setCategoryTests([]); }} className="text-sm font-semibold text-slate-600">Закрити</button></div><div className="mt-4 space-y-4">{categoryTests.length === 0 && <p className="text-sm text-slate-500">У цій категорії ще немає тестів.</p>}{categoryTests.map((test) => <article key={test.id} className="rounded-xl bg-slate-50 p-4"><h3 className="font-bold">{test.title}</h3>{test.questions.length === 0 && <p className="mt-2 text-sm text-slate-500">Питань ще немає.</p>}<ol className="mt-3 space-y-3">{test.questions.map((question, questionIndex) => <li key={questionIndex} className="rounded-lg border border-slate-200 bg-white p-3"><p className="font-semibold">{questionIndex + 1}. {question.text}</p><p className="mt-1 text-xs text-slate-600">{question.points} балів · {question.timeLimitSeconds} сек. · можна обрати: {question.options.filter((option) => option.isCorrect).length}</p><ul className="mt-2 space-y-1 text-sm">{question.options.map((option, optionIndex) => <li key={optionIndex} className={option.isCorrect ? 'text-brand' : 'text-slate-700'}>{option.isCorrect ? '✓' : '•'} {option.text}</li>)}</ul></li>)}</ol></article>)}</div></section>}
    <form onSubmit={saveTest} className="mt-6 rounded-2xl border border-slate-200 p-5"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-bold">{editingId ? 'Редагувати тест' : 'Створити тест'}</h2>{editingId && <button type="button" onClick={resetForm} className="text-sm font-semibold text-slate-600">Скасувати редагування</button>}</div>{editingHasAttempts && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Питання та варіанти відповідей заблоковані, бо цей тест уже проходили працівники.</p>}<div className="mt-4 grid gap-3 sm:grid-cols-3"><select required value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className="rounded-xl border p-2"><option value="">Категорія</option>{data.categories.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select><input required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Назва тесту" className="rounded-xl border p-2 sm:col-span-2" /><label className="text-sm">Прохідний бал<input type="number" min="0" value={passingScore} onChange={(event) => setPassingScore(Number(event.target.value))} className="mt-1 w-full rounded-xl border p-2" /></label><label className="sm:col-span-2 text-sm">Опис<input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Короткий опис для працівника" className="mt-1 w-full rounded-xl border p-2" /></label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={isPublished} onChange={(event) => setIsPublished(event.target.checked)} /> Опублікувати</label></div>
      {questions.map((question, questionIndex) => <div key={questionIndex} className="mt-5 rounded-xl bg-slate-50 p-4"><div className="flex justify-between gap-3"><b>Питання {questionIndex + 1}</b>{questions.length > 1 && !questionControlsDisabled && <button type="button" onClick={() => setQuestions((all) => all.filter((_, index) => index !== questionIndex))} className="text-sm text-red-700">Видалити</button>}</div><input required disabled={questionControlsDisabled} value={question.text} onChange={(event) => setQuestion(questionIndex, { text: event.target.value })} placeholder="Текст питання" className="mt-3 w-full rounded-xl border p-2 disabled:bg-slate-100" /><div className="mt-3 grid gap-2 sm:grid-cols-2"><label className="text-xs">Бал<input disabled={questionControlsDisabled} type="number" min="1" value={question.points} onChange={(event) => setQuestion(questionIndex, { points: Number(event.target.value) })} className="mt-1 w-full rounded border p-2 disabled:bg-slate-100" /><span className="mt-1 block font-normal text-slate-500">Загальний бал за питання.</span></label><label className="text-xs">Час, сек.<input disabled={questionControlsDisabled} type="number" min="5" value={question.timeLimitSeconds} onChange={(event) => setQuestion(questionIndex, { timeLimitSeconds: Number(event.target.value) })} className="mt-1 w-full rounded border p-2 disabled:bg-slate-100" /></label></div><p className="mt-2 text-xs text-slate-600">Можна обрати: {question.options.filter((option) => option.isCorrect).length}. Кількість визначається автоматично за правильними варіантами. Правильний варіант додає частину балів, неправильний віднімає таку саму частину. Нижче 0 балів за питання не нараховується.</p><div className="mt-3 space-y-2">{question.options.map((option, optionIndex) => <div key={optionIndex} className="flex gap-2"><input disabled={questionControlsDisabled} type="checkbox" checked={option.isCorrect} onChange={(event) => setOption(questionIndex, optionIndex, { isCorrect: event.target.checked })} /><input required disabled={questionControlsDisabled} value={option.text} onChange={(event) => setOption(questionIndex, optionIndex, { text: event.target.value })} placeholder={`Варіант ${optionIndex + 1}`} className="flex-1 rounded border p-2 disabled:bg-slate-100" />{question.options.length > 2 && !questionControlsDisabled && <button type="button" onClick={() => setQuestion(questionIndex, { options: question.options.filter((_, index) => index !== optionIndex) })}>×</button>}</div>)}</div>{!questionControlsDisabled && <button type="button" onClick={() => setQuestion(questionIndex, { options: [...question.options, { text: '', isCorrect: false }] })} className="mt-2 text-sm text-brand">+ Варіант</button>}</div>)}
      {!questionControlsDisabled && <button type="button" onClick={() => setQuestions((all) => [...all, blankQuestion()])} className="mt-4 rounded-xl border border-brand px-4 py-2 text-sm font-bold text-brand">+ Питання</button>}<button disabled={busy} className="ml-3 mt-4 rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white">{busy ? 'Збереження...' : editingId ? 'Зберегти зміни' : 'Створити тест'}</button></form>
    {archivedTests.length > 0 && <section className="mt-6 rounded-2xl border border-slate-200 p-4"><h2 className="font-bold">Архів тестів</h2><div className="mt-3 space-y-3">{archivedTests.map((test) => <article key={test.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-3 text-sm"><div><b>{test.title}</b><p className="mt-1 text-slate-600">Спроб: {test.attemptCount}</p></div><div className="flex flex-wrap gap-2"><button type="button" disabled={busy} onClick={() => void testAction('restore', test)} className="rounded-lg border border-brand px-3 py-1.5 font-semibold text-brand">Відновити</button>{test.attemptCount === 0 && <button type="button" disabled={busy} onClick={() => void testAction('delete', test)} className="rounded-lg border border-red-300 px-3 py-1.5 font-semibold text-red-700">Видалити</button>}</div></article>)}</div></section>}
    <section className="mt-6 rounded-2xl border border-slate-200 p-4"><h2 className="font-bold">Останні результати</h2>{data.attempts.map((attempt) => <p key={attempt.id} className="mt-2 text-sm">{attempt.userName}: <b>{attempt.testTitle}</b> — {attempt.score}/{attempt.maxScore}, {attempt.status}</p>)}</section>
  </div>;
}
