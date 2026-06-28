import './style.css';
import TESTS from '../tests.yaml';

// ─── State ───────────────────────────────────────────────────────────────────
const LS_KEY = 'slot-qa-state';
const state = {};
const allTests = [];

// normalise each test entry: string → { label } object
function normalise(t) {
  return typeof t === 'string' ? { label: t } : t;
}

TESTS.forEach((cat, ci) => {
  cat.tests.forEach((t, ti) => {
    const id = `${ci}-${ti}`;
    state[id] = null;
    allTests.push({ id, category: cat.category, label: normalise(t).label });
  });
});

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

    const passed = cat.tests.filter((_, ti) => state[`${ci}-${ti}`] === 'pass').length;
    const header = document.createElement('div');
    header.className = 'category-header';
    header.innerHTML = `
      <span class="category-title">${cat.category}</span>
      <span class="category-score">${passed}/${cat.tests.length}</span>
    `;
    catEl.appendChild(header);

    cat.tests.forEach((t, ti) => {
      const test = normalise(t);
      const id = `${ci}-${ti}`;
      const status = state[id];

      const item = document.createElement('div');
      item.className = 'test-item';

      // main row: label + optional info btn + status buttons
      const main = document.createElement('div');
      main.className = 'test-main';

      const lbl = document.createElement('span');
      lbl.className = 'test-label' +
        (status === 'pass' ? ' passed' : status === 'fail' ? ' failed' : status === 'skip' ? ' skipped' : '');
      lbl.textContent = test.label;
      main.appendChild(lbl);

      // info button — only if steps exist
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
        item.appendChild(main);
        item.appendChild(stepsEl);
      } else {
        item.appendChild(main);
      }

      const btnGroup = document.createElement('div');
      btnGroup.className = 'btn-group';
      ['pass', 'fail', 'skip'].forEach(s => {
        const btn = document.createElement('button');
        btn.className = `btn-status ${s}${status === s ? ' active' : ''}`;
        btn.title = s.charAt(0).toUpperCase() + s.slice(1);
        btn.textContent = s === 'pass' ? '✓' : s === 'fail' ? '✗' : '–';
        btn.onclick = () => {
          state[id] = state[id] === s ? null : s;
          render();
          updateStats();
          saveToStorage();
        };
        btnGroup.appendChild(btn);
      });

      main.appendChild(btnGroup);
      catEl.appendChild(item);
    });

    list.appendChild(catEl);
  });
}

function updateStats() {
  const values = Object.values(state);
  const pass = values.filter(v => v === 'pass').length;
  const fail = values.filter(v => v === 'fail').length;
  const skip = values.filter(v => v === 'skip').length;
  const total = pass + fail + skip;

  document.getElementById('statTotal').textContent = total;
  document.getElementById('statAllTotal').textContent = allTests.length;
  document.getElementById('statPass').textContent = pass;
  document.getElementById('statFail').textContent = fail;
  document.getElementById('statSkip').textContent = skip;

  const pct = allTests.length > 0 ? (total / allTests.length) * 100 : 0;
  document.getElementById('progressFill').style.width = pct + '%';
}

// ─── Jira markup ─────────────────────────────────────────────────────────────
function buildJiraMarkup() {
  const game = document.getElementById('gameName').value.trim() || '—';
  const date = new Date().toLocaleDateString('en-GB');

  const values = Object.values(state);
  const pass = values.filter(v => v === 'pass').length;
  const fail = values.filter(v => v === 'fail').length;
  const skip = values.filter(v => v === 'skip').length;
  const total = allTests.length;

  let out = `*QA Acceptance Test* — ${game}\n`;
  out += `Date: ${date}\n`;
  out += `Result: *${pass}/${total} passed*`;
  if (fail > 0) out += ` | ❌ ${fail} failed`;
  if (skip > 0) out += ` | ⏭ ${skip} skipped`;
  out += '\n\n';

  TESTS.forEach((cat, ci) => {
    out += `*${cat.category}*\n`;
    cat.tests.forEach((t, ti) => {
      const s = state[`${ci}-${ti}`];
      const icon = s === 'pass' ? '(/)' : s === 'fail' ? '(x)' : s === 'skip' ? '(!)' : '( )';
      out += `${icon} ${normalise(t).label}\n`;
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
