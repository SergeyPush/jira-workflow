import './style.css';
import TESTS from '../tests.yaml';

// ─── Constants ────────────────────────────────────────────────────────────────
const LS_KEY = 'slot-qa-state';

const STATUS_CLASS  = { pass: ' passed', fail: ' failed', skip: ' skipped' };
const STATUS_SYMBOL = { pass: '✓', fail: '✗', skip: '–' };
const STATUS_JIRA   = { pass: '(/)', fail: '(x)', skip: '(!)', null: '( )' };

// ─── State ────────────────────────────────────────────────────────────────────
const state = {};

// Pre-normalise all tests once at init: string → { label } object
const allTests = TESTS.flatMap((cat, ci) =>
  cat.tests.map((t, ti) => {
    const test = typeof t === 'string' ? { label: t } : t;
    const id = `${ci}-${ti}`;
    state[id] = null;
    return { id, ci, ti, category: cat.category, ...test };
  })
);

// Cached DOM refs for stats (queried once, updated frequently)
const elStats = {
  total:    document.getElementById('statTotal'),
  allTotal: document.getElementById('statAllTotal'),
  pass:     document.getElementById('statPass'),
  fail:     document.getElementById('statFail'),
  skip:     document.getElementById('statSkip'),
  fill:     document.getElementById('progressFill'),
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function computeCounts() {
  return Object.values(state).reduce(
    (acc, v) => { if (v) acc[v]++; return acc; },
    { pass: 0, fail: 0, skip: 0 }
  );
}

function saveToStorage() {
  localStorage.setItem(LS_KEY, JSON.stringify({
    state,
    gameName: document.getElementById('gameName').value,
  }));
}

function loadFromStorage() {
  try {
    const saved = JSON.parse(localStorage.getItem(LS_KEY));
    if (!saved) return;
    if (saved.gameName) document.getElementById('gameName').value = saved.gameName;
    Object.keys(saved.state).forEach(k => {
      if (k in state) state[k] = saved.state[k];
    });
  } catch (e) { /* ignore corrupt data */ }
}

// ─── Render ──────────────────────────────────────────────────────────────────
function render() {
  const list = document.getElementById('checklist');
  list.innerHTML = '';

  TESTS.forEach((cat, ci) => {
    const catEl = document.createElement('div');
    catEl.className = 'category';

    const total    = cat.tests.length;
    const passed   = cat.tests.filter((_, ti) => state[`${ci}-${ti}`] === 'pass').length;
    const failed   = cat.tests.filter((_, ti) => state[`${ci}-${ti}`] === 'fail').length;
    const reviewed = cat.tests.filter((_, ti) => state[`${ci}-${ti}`] !== null).length;
    const allDone  = reviewed === total;
    const doneClass = !allDone ? '' : failed > 0 ? ' done-fail' : passed === total ? ' done-pass' : ' done-skip';
    const doneIcon  = !allDone ? `${passed}/${total}` : failed > 0 ? '✗' : passed === total ? '✓' : '–';

    const header = document.createElement('div');
    header.className = 'category-header' + doneClass;
    header.innerHTML = `
      <span class="category-title">${cat.category}</span>
      <span class="category-score">${doneIcon}</span>
    `;
    catEl.appendChild(header);

    cat.tests.forEach((_, ti) => {
      const test = allTests.find(t => t.ci === ci && t.ti === ti);
      const id = `${ci}-${ti}`;
      const status = state[id];

      const item = document.createElement('div');
      item.className = 'test-item';

      const main = document.createElement('div');
      main.className = 'test-main';

      const lbl = document.createElement('span');
      lbl.className = 'test-label' + (STATUS_CLASS[status] || '');
      lbl.textContent = test.label;
      main.appendChild(lbl);

      if (test.steps?.length) {
        const stepsEl = document.createElement('div');
        stepsEl.className = 'test-steps';
        const ol = document.createElement('ol');
        test.steps.forEach(s => {
          const li = document.createElement('li');
          li.textContent = s;
          ol.appendChild(li);
        });
        stepsEl.appendChild(ol);

        const infoBtn = document.createElement('button');
        infoBtn.className = 'btn-info';
        infoBtn.title = 'Show steps';
        infoBtn.textContent = '?';
        infoBtn.onclick = () => {
          const open = stepsEl.classList.toggle('visible');
          infoBtn.classList.toggle('active', open);
        };
        main.appendChild(infoBtn);
        item.appendChild(stepsEl);
      }

      const btnGroup = document.createElement('div');
      btnGroup.className = 'btn-group';
      ['pass', 'fail', 'skip'].forEach(s => {
        const btn = document.createElement('button');
        btn.className = `btn-status ${s}${status === s ? ' active' : ''}`;
        btn.title = s.charAt(0).toUpperCase() + s.slice(1);
        btn.textContent = STATUS_SYMBOL[s];
        btn.onclick = () => {
          state[id] = state[id] === s ? null : s;
          render();
          updateStats();
          saveToStorage();
        };
        btnGroup.appendChild(btn);
      });

      main.appendChild(btnGroup);
      item.prepend(main);
      catEl.appendChild(item);
    });

    list.appendChild(catEl);
  });
}

function updateStats() {
  const { pass, fail, skip } = computeCounts();
  const total = pass + fail + skip;

  elStats.total.textContent    = total;
  elStats.allTotal.textContent = allTests.length;
  elStats.pass.textContent     = pass;
  elStats.fail.textContent     = fail;
  elStats.skip.textContent     = skip;
  elStats.fill.style.width     = allTests.length > 0 ? `${(total / allTests.length) * 100}%` : '0%';
}

// ─── Jira markup ─────────────────────────────────────────────────────────────
function buildJiraMarkup() {
  const game = document.getElementById('gameName').value.trim() || '—';
  const date = new Date().toLocaleDateString('en-GB');
  const { pass, fail, skip } = computeCounts();

  let out = `*QA Acceptance Test* — ${game}\n`;
  out += `Date: ${date}\n`;
  out += `Result: *${pass}/${allTests.length} passed*`;
  if (fail > 0) out += ` | ❌ ${fail} failed`;
  if (skip > 0) out += ` | ⏭ ${skip} skipped`;
  out += '\n\n';

  TESTS.forEach((cat, ci) => {
    out += `*${cat.category}*\n`;
    cat.tests.forEach((_, ti) => {
      const test = allTests.find(t => t.ci === ci && t.ti === ti);
      const s = state[`${ci}-${ti}`];
      out += `${STATUS_JIRA[s] ?? '( )'} ${test.label}\n`;
    });
    out += '\n';
  });

  return out.trim();
}

// ─── Actions ─────────────────────────────────────────────────────────────────
document.getElementById('btnCopy').addEventListener('click', () => {
  const markup = buildJiraMarkup();
  document.getElementById('previewContent').textContent = markup;
  document.getElementById('preview').classList.add('visible');

  navigator.clipboard.writeText(markup).then(() => {
    const btn = document.getElementById('btnCopy');
    btn.textContent = '✓ Copied!';
    btn.classList.add('copied');
    setTimeout(() => { btn.textContent = 'Copy for Jira'; btn.classList.remove('copied'); }, 2000);

    const toast = document.getElementById('toast');
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
  });
});

document.getElementById('btnReset').addEventListener('click', () => {
  if (!confirm('Reset all test results?')) return;
  Object.keys(state).forEach(k => state[k] = null);
  document.getElementById('gameName').value = '';
  render();
  updateStats();
  saveToStorage();
  document.getElementById('preview').classList.remove('visible');
});

document.getElementById('previewClose').addEventListener('click', () => {
  document.getElementById('preview').classList.remove('visible');
});

document.getElementById('gameName').addEventListener('input', saveToStorage);

// ─── Init ─────────────────────────────────────────────────────────────────────
loadFromStorage();
render();
updateStats();
document.body.style.visibility = 'visible';
