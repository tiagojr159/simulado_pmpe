const API = 'api.php';
const LETTERS = ['A', 'B', 'C', 'D', 'E'];
const modals = ['setupModal', 'examModal', 'resultModal', 'rankingModal'];
let questions = [];
let activePassages = {};
let activeExams = {};
let answers = {};
let activeCandidate = null;
let activeLength = 30;
let currentIndex = 0;
let toastTimer;
let cityRequest = 0;

function shuffle(items) {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

const $ = (selector) => document.querySelector(selector);
const escapeHTML = (value = '') => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

function showModal(id) {
  modals.forEach(modal => { const element = document.getElementById(modal); if (element) element.hidden = modal !== id; });
  document.body.classList.add('modal-open');
  const dialog = document.querySelector(`#${id} [role="dialog"]`);
  dialog?.setAttribute('tabindex', '-1');
  dialog?.focus({ preventScroll: true });
}
function hideModals() {
  modals.forEach(id => { const element = document.getElementById(id); if (element) element.hidden = true; });
  document.body.classList.remove('modal-open');
}
function toast(message) {
  const box = $('#toast'); box.textContent = message; box.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => box.classList.remove('show'), 2800);
}
async function api(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'Não foi possível concluir a solicitação.');
  return body;
}

async function loadStates() {
  const stateSelect = $('#stateSelect');
  try {
    const response = await fetch('https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome');
    if (!response.ok) throw new Error('Estados indisponíveis');
    const states = await response.json();
    stateSelect.innerHTML = '<option value="">Escolha o estado</option>' + states.map(state => `<option value="${escapeHTML(state.sigla)}">${escapeHTML(state.nome)}</option>`).join('');
    stateSelect.value = 'PE'; stateSelect.dispatchEvent(new Event('change'));
  } catch {
    const states = {AC:'Acre',AL:'Alagoas',AP:'Amapá',AM:'Amazonas',BA:'Bahia',CE:'Ceará',DF:'Distrito Federal',ES:'Espírito Santo',GO:'Goiás',MA:'Maranhão',MT:'Mato Grosso',MS:'Mato Grosso do Sul',MG:'Minas Gerais',PA:'Pará',PB:'Paraíba',PR:'Paraná',PE:'Pernambuco',PI:'Piauí',RJ:'Rio de Janeiro',RN:'Rio Grande do Norte',RS:'Rio Grande do Sul',RO:'Rondônia',RR:'Roraima',SC:'Santa Catarina',SP:'São Paulo',SE:'Sergipe',TO:'Tocantins'};
    stateSelect.innerHTML = '<option value="">Escolha o estado</option>' + Object.entries(states).sort((a,b) => a[1].localeCompare(b[1], 'pt-BR')).map(([code,name]) => `<option value="${code}">${escapeHTML(name)}</option>`).join('');
    stateSelect.value = 'PE'; stateSelect.dispatchEvent(new Event('change'));
    toast('Usando a lista local de estados.');
  }
}

async function loadCities(stateCode) {
  const citySelect = $('#citySelect'); citySelect.disabled = true;
  citySelect.innerHTML = '<option value="">Carregando cidades…</option>';
  if (!stateCode) { citySelect.innerHTML = '<option value="">Selecione o estado primeiro</option>'; return; }
  try {
    const response = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${encodeURIComponent(stateCode)}/municipios?orderBy=nome`);
    if (!response.ok) throw new Error('Cidades indisponíveis');
    const cities = await response.json();
    citySelect.innerHTML = '<option value="">Escolha a cidade</option>' + cities.map(city => `<option value="${escapeHTML(city.nome)}">${escapeHTML(city.nome)}</option>`).join('');
    citySelect.disabled = false;
  } catch {
    citySelect.innerHTML = '<option value="">Não foi possível carregar</option>';
    toast('Confira sua conexão para carregar as cidades.');
  }
}

function openSetup() { showModal('setupModal'); if (!$('#stateSelect').options.length || $('#stateSelect').options.length === 1) loadStates(); }

async function beginExam(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  const data = new FormData(form);
  activeCandidate = { name: String(data.get('name')).trim(), state: $('#stateSelect').selectedOptions[0].textContent, city: data.get('city') };
  activeLength = Number(data.get('length'));
  try {
    const payload = await api(`${API}?action=questions`);
    activePassages = Object.fromEntries((payload.passages || []).map(passage => [passage.id, passage]));
    activeExams = Object.fromEntries((payload.exams || []).map(exam => [exam.id, exam]));
    questions = shuffle(payload.questions).slice(0, activeLength);
    if (questions.length !== activeLength) throw new Error('O banco de perguntas ainda não tem questões suficientes.');
    answers = {}; currentIndex = 0; renderQuestion(); showModal('examModal');
  } catch (error) { toast(error.message); }
}

function formatStatementLines(value) { return String(value || '').replace(/\s+(I{1,3}|IV)\.\s+/g, '\n$1. '); }

function renderQuestion() {
  const question = questions[currentIndex];
  const percent = Math.round(((currentIndex + 1) / activeLength) * 100);
  $('#questionCounter').textContent = `QUESTÃO ${String(currentIndex + 1).padStart(2, '0')} DE ${activeLength}`;
  $('#progressPercent').textContent = `${percent}%`;
  $('#progressBar').style.width = `${percent}%`;
  $('#subjectBadge').textContent = question.subject.toLocaleUpperCase('pt-BR');
  $('#examTitle').textContent = formatStatementLines(question.question);
  const base = $('#baseText');
  const passage = question.passageId ? activePassages[question.passageId] : null;
  if (passage) {
    base.classList.add('has-passage');
    const passageImage = passage.figure ? '<img class="passage-figure" src="' + escapeHTML(passage.figure) + '" alt="' + escapeHTML(passage.figureAlt || '') + '">' : '';
    base.innerHTML = '<strong class="passage-title">' + escapeHTML(passage.label) + ' · ' + escapeHTML(activeExams[question.examId]?.title || 'Simulado PMPE') + '</strong><p>' + escapeHTML(passage.content) + '</p>' + passageImage;
    base.hidden = false;
  } else if (question.base) {
    base.classList.remove('has-passage');
    base.textContent = question.base;
    base.hidden = false;
  } else { base.classList.remove('has-passage'); base.textContent = ''; base.hidden = true; }
  const oldFigure = $('.question-figure'); oldFigure?.remove();
  if (question.figure) {
    const figure = document.createElement('img'); figure.className = 'question-figure'; figure.src = question.figure; figure.alt = question.figureAlt || 'Figura de apoio à questão';
    (question.base ? base : $('#examTitle')).insertAdjacentElement(question.base ? 'afterend' : 'beforebegin', figure);
  }
  const optionMarkup = LETTERS.map(letter => {
    const selected = answers[question.id] === letter;
    const disabled = question.voided ? 'disabled aria-disabled="true"' : '';
    return '<button type="button" class="answer-option ' + (selected ? 'selected' : '') + '" data-answer="' + letter + '" aria-pressed="' + selected + '" ' + disabled + '><span class="answer-letter">' + letter + '</span><span class="answer-text">' + escapeHTML(formatStatementLines(question.options[letter])) + '</span><span class="answer-check">✓</span></button>';
  }).join('');
  const voidNotice = question.voided ? '<div class="voided-question" role="note">Esta questão foi anulada no gabarito definitivo. O ponto será atribuído automaticamente.</div>' : '';
  $('#answerList').innerHTML = voidNotice + optionMarkup;
  if (question.voided) answers[question.id] = 'VOIDED';
  else $('#answerList').querySelectorAll('[data-answer]').forEach(button => button.addEventListener('click', () => {
    answers[question.id] = button.dataset.answer;
    $('#answerList').querySelectorAll('[data-answer]').forEach(item => { const selected = item === button; item.classList.toggle('selected', selected); item.setAttribute('aria-pressed', String(selected)); });
    $('#nextButton').disabled = false;
  }));
  $('#previousButton').disabled = currentIndex === 0;
  $('#nextButton').disabled = !answers[question.id];
  $('#nextButton').innerHTML = currentIndex === activeLength - 1 ? 'Finalizar simulado <span>✓</span>' : 'Próxima questão ';
}

async function advance() {
  if (!questions[currentIndex].voided && !answers[questions[currentIndex].id]) return;
  if (questions[currentIndex].voided) answers[questions[currentIndex].id] = 'VOIDED';
  if (currentIndex < activeLength - 1) { currentIndex++; renderQuestion(); return; }
  $('#nextButton').disabled = true;
  try {
    const payload = await api(`${API}?action=submit`, { method: 'POST', body: JSON.stringify({ ...activeCandidate, length: activeLength, answers }) });
    showResult(payload.result);
  } catch (error) { toast(error.message); $('#nextButton').disabled = false; }
}

function showResult(result) {
  $('#scoreValue').textContent = result.score;
  $('#resultStatus').textContent = result.status;
  $('#resultStatus').className = `result-status ${result.status === 'Reprovado' ? 'reprovado' : result.status === 'Fila de remanejamento' ? 'remanejamento' : ''}`;
  $('#resultEmblem').textContent = result.status === 'Reprovado' ? '' : '★';
  $('#resultTitle').textContent = result.status === 'Aprovado' ? 'Parabéns pela conquista!' : result.status === 'Fila de remanejamento' ? 'Você está no caminho.' : 'Todo treino é um começo.';
  $('#resultDetail').textContent = `Você acertou ${result.correct} de ${result.total} questões${result.voided ? ', incluindo ' + result.voided + (result.voided === 1 ? ' questão anulada com ponto automático' : ' questões anuladas com ponto automático') : ''}. Seu resultado já foi salvo no ranking.`;
  showModal('resultModal');
}

async function openRanking() {
  showModal('rankingModal');
  const list = $('#rankingList'); list.innerHTML = '<div class="ranking-loading">Carregando resultados…</div>';
  try {
    const { ranking } = await api(`${API}?action=ranking`);
    if (!ranking.length) { list.innerHTML = '<div class="ranking-empty"><strong>O ranking começa com você.</strong>Faça o simulado e seu resultado aparecerá aqui.</div>'; return; }
    list.innerHTML = ranking.map((row, index) => {
      const date = new Date(row.date);
      const dateLabel = Number.isNaN(date.valueOf()) ? '' : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date);
      const note = (Number(row.score) / 10).toFixed(1).replace('.', ',');
      const noteClass = Number(row.score) > 80 ? 'nota-green' : Number(row.score) >= 60 ? 'nota-orange' : 'nota-red';
      return `<div class="ranking-row"><div class="rank-person"><span class="rank-number">${String(index + 1).padStart(2, '0')}</span><span class="rank-name"><strong>${escapeHTML(row.name)}</strong><small>${escapeHTML(row.city)} · ${escapeHTML(row.state)}${dateLabel ? ` · ${escapeHTML(dateLabel)}` : ''}</small></span></div><span class="rank-score"><small>${Number(row.correct)}/${Number(row.total)} acertos</small></span><span class="rank-note ${noteClass}">${note}</span></div>`;
    }).join('');
  } catch (error) { list.innerHTML = `<div class="ranking-empty">${escapeHTML(error.message)}</div>`; }
}

$('#startButton').addEventListener('click', openSetup);
$('#bottomStart').addEventListener('click', event => { event.preventDefault(); openSetup(); });
$('#rankingButton').addEventListener('click', openRanking);
$('#rankingStart').addEventListener('click', openSetup);
$('#resultRanking').addEventListener('click', openRanking);
$('#setupForm').addEventListener('submit', beginExam);
$('#stateSelect').addEventListener('change', event => loadCities(event.target.value));
$('#nextButton').addEventListener('click', advance);
$('#previousButton').addEventListener('click', () => { if (currentIndex > 0) { currentIndex--; renderQuestion(); } });
document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', hideModals));
document.querySelectorAll('.modal-backdrop').forEach(backdrop => backdrop.addEventListener('click', event => { if (event.target === backdrop) hideModals(); }));
document.addEventListener('keydown', event => { if (event.key === 'Escape' && modals.some(id => !document.getElementById(id).hidden)) hideModals(); });

api(`${API}?action=questions`).then(({ questions: bankQuestions }) => { const counter = $('#questionBankCount'); if (counter) counter.textContent = `${bankQuestions.length} quest\u00f5es dispon\u00edveis`; }).catch(() => {});
