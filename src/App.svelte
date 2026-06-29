<script>
  import TESTS from '../tests.yaml';

  const LS_KEY = 'slot-qa-state';

  const STATUS_SYMBOL = { pass: '✓', fail: '✗', skip: '–' };
  const STATUS_JIRA   = { pass: '(/)', fail: '(x)', skip: '(!)', null: '( )' };

  // Status → Tailwind color tokens (bg, border, text, dot)
  const STATUS_THEME = {
    pass: { bg: 'bg-[#dcfce7]', border: 'border-[#bbf7d0]', text: 'text-[#16a34a]', dot: 'bg-[#16a34a]' },
    fail: { bg: 'bg-[#fee2e2]', border: 'border-[#fecaca]', text: 'text-[#dc2626]', dot: 'bg-[#dc2626]' },
    skip: { bg: 'bg-[#fef3c7]', border: 'border-[#fde68a]', text: 'text-[#d97706]', dot: 'bg-[#d97706]' },
  };

  // Flatten all tests with stable IDs
  const allTests = TESTS.flatMap((cat, ci) =>
    cat.tests.map((t, ti) => {
      const test = typeof t === 'string' ? { label: t } : t;
      return { id: `${ci}-${ti}`, ci, ti, category: cat.category, ...test };
    })
  );

  // O(1) test lookup by id
  const testById = Object.fromEntries(allTests.map(t => [t.id, t]));

  // ── Reactive state ────────────────────────────────────────────────────────────
  let testState = $state(Object.fromEntries(allTests.map(t => [t.id, null])));
  let gameName  = $state('');
  let showPreview  = $state(false);
  let showToast    = $state(false);
  let openSteps    = $state(Object.fromEntries(allTests.map(t => [t.id, false])));
  let copied       = $state(false);

  // Load persisted state
  try {
    const saved = JSON.parse(localStorage.getItem(LS_KEY));
    if (saved) {
      if (saved.gameName) gameName = saved.gameName;
      Object.keys(saved.state).forEach(k => { if (k in testState) testState[k] = saved.state[k]; });
    }
  } catch { /* ignore corrupt data */ }

  // ── Derived ───────────────────────────────────────────────────────────────────
  const counts = $derived(
    Object.values(testState).reduce(
      (acc, v) => { if (v) acc[v]++; return acc; },
      { pass: 0, fail: 0, skip: 0 }
    )
  );
  const reviewed    = $derived(counts.pass + counts.fail + counts.skip);
  const progress    = $derived(allTests.length > 0 ? (reviewed / allTests.length) * 100 : 0);
  const catInfos    = $derived(TESTS.map((_, ci) => catInfo(ci)));
  const previewText = $derived(showPreview ? buildJira() : '');

  // ── Helpers ───────────────────────────────────────────────────────────────────
  function save() {
    localStorage.setItem(LS_KEY, JSON.stringify({ state: testState, gameName }));
  }

  function toggle(id, status) {
    testState[id] = testState[id] === status ? null : status;
    save();
  }

  function catInfo(ci) {
    const total = TESTS[ci].tests.length;
    const { pass, fail, rev } = TESTS[ci].tests.reduce(
      (acc, _, ti) => {
        const v = testState[`${ci}-${ti}`];
        if (v !== null) acc.rev++;
        if (v === 'pass') acc.pass++;
        else if (v === 'fail') acc.fail++;
        return acc;
      },
      { pass: 0, fail: 0, rev: 0 }
    );
    const allDone  = rev === total;
    const doneType = !allDone ? null : fail > 0 ? 'fail' : pass === total ? 'pass' : 'skip';
    const icon     = doneType ? STATUS_SYMBOL[doneType] : `${pass}/${total}`;
    return { doneType, icon };
  }

  function buildJira() {
    const game = gameName.trim() || '—';
    const date = new Date().toLocaleDateString('en-GB');
    const { pass, fail, skip } = counts;

    let out = `*QA Acceptance Test* — ${game}\n`;
    out    += `Date: ${date}\n`;
    out    += `Result: *${pass}/${allTests.length} passed*`;
    if (fail > 0) out += ` | ❌ ${fail} failed`;
    if (skip > 0) out += ` | ⏭ ${skip} skipped`;
    out += '\n\n';

    // Iterate flat list; emit category header on boundary change
    let lastCi = -1;
    for (const test of allTests) {
      if (test.ci !== lastCi) {
        if (lastCi !== -1) out += '\n';
        out += `*${test.category}*\n`;
        lastCi = test.ci;
      }
      out += `${STATUS_JIRA[testState[test.id]] ?? '( )'} ${test.label}\n`;
    }

    return out.trim();
  }

  function copyJira() {
    showPreview = true;
    navigator.clipboard.writeText(buildJira()).then(() => {
      copied    = true;
      showToast = true;
      setTimeout(() => { copied = false; }, 2000);
      setTimeout(() => { showToast = false; }, 2500);
    });
  }

  function reset() {
    if (!confirm('Reset all test results?')) return;
    Object.keys(testState).forEach(k => { testState[k] = null; });
    Object.keys(openSteps).forEach(k => { openSteps[k] = false; });
    gameName    = '';
    showPreview = false;
    save();
  }
</script>

<!-- ── Layout ─────────────────────────────────────────────────────────────── -->
<div class="min-h-screen bg-[#f4f5f7] py-10 px-4 pb-16 text-sm text-[#111827]">
  <div class="mx-auto max-w-[680px]">

    <!-- Header -->
    <header class="mb-7">
      <h1 class="text-xl font-semibold tracking-tight">Slot QA Checklist</h1>
      <p class="mt-0.5 text-[13px] text-[#9ca3af]">Mark each test, then copy results to Jira.</p>
    </header>

    <!-- Game name input -->
    <div class="mb-5">
      <input
        type="text"
        placeholder="Game name (e.g. Lucky Joker 100)"
        bind:value={gameName}
        oninput={save}
        class="w-full rounded-md border border-[#e5e7eb] bg-white px-3.5 py-2.5 text-sm text-[#111827]
               shadow-sm outline-none placeholder:text-[#9ca3af]
               focus:border-[#4f46e5] focus:ring-3 focus:ring-indigo-500/10
               transition-[border-color,box-shadow] duration-150"
      />
    </div>

    <!-- Progress bar -->
    <div class="mb-5">
      <div class="h-[5px] overflow-hidden rounded-full bg-[#e5e7eb]">
        <div
          class="h-full rounded-full bg-gradient-to-r from-[#4f46e5] to-[#818cf8] transition-[width] duration-350 ease-[cubic-bezier(0.4,0,0.2,1)]"
          style="width: {progress}%"
        ></div>
      </div>
    </div>

    <!-- Stats -->
    <div class="mb-6 flex flex-wrap gap-2">
      <span class="stat bg-[#eef2ff] border-[#c7d2fe] text-[#4f46e5]">
        Reviewed: <b>{reviewed}</b> / <b>{allTests.length}</b>
      </span>
      <span class="stat bg-[#dcfce7] border-[#bbf7d0] text-[#16a34a]">
        Passed: <b>{counts.pass}</b>
      </span>
      <span class="stat bg-[#fee2e2] border-[#fecaca] text-[#dc2626]">
        Failed: <b>{counts.fail}</b>
      </span>
      <span class="stat bg-[#fef3c7] border-[#fde68a] text-[#d97706]">
        Skipped: <b>{counts.skip}</b>
      </span>
    </div>

    <!-- Checklist -->
    {#each TESTS as cat, ci}
      {@const info = catInfos[ci]}
      {@const theme = info.doneType ? STATUS_THEME[info.doneType] : null}
      <div class="mb-2.5 overflow-hidden rounded-[10px] border border-[#e5e7eb] bg-white shadow-sm">

        <!-- Category header -->
        <div class="flex items-center justify-between border-b px-4 py-2.5
          {theme ? `${theme.bg} ${theme.border}` : 'bg-[#f9fafb] border-[#e5e7eb]'}">
          <span class="text-[11px] font-semibold uppercase tracking-[0.07em]
            {theme ? theme.text : 'text-[#6b7280]'}">
            {cat.category}
          </span>
          <!-- Score badge -->
          {#if theme}
            <span class="flex h-[22px] w-[22px] items-center justify-center rounded-full text-[13px] font-bold text-white {theme.dot}">
              {info.icon}
            </span>
          {:else}
            <span class="rounded-full bg-[#e5e7eb] px-1.5 py-0.5 text-[11px] font-medium text-[#9ca3af]">
              {info.icon}
            </span>
          {/if}
        </div>

        <!-- Tests -->
        {#each cat.tests as _, ti}
          {@const id   = `${ci}-${ti}`}
          {@const test = testById[id]}
          {@const s    = testState[id]}
          <div class="flex flex-wrap items-center gap-3 border-b border-[#f3f4f6] px-4 py-[11px] last:border-b-0 hover:bg-[#f9fafb] transition-colors duration-100">

            <!-- Label row -->
            <div class="flex w-full items-center gap-3">
              <!-- Label -->
              <span class="flex-1 text-[15px] select-none transition-colors duration-150
                {s === 'pass' ? 'font-medium text-[#16a34a]'
                : s === 'fail' ? 'text-[#dc2626] line-through opacity-75'
                : s === 'skip' ? 'italic text-[#d97706] opacity-80'
                : 'text-[#111827]'}">
                {test.label}
              </span>

              <!-- Info button (steps) -->
              {#if test.steps?.length}
                <button
                  onclick={() => { openSteps[id] = !openSteps[id]; }}
                  class="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border text-[11px] font-bold
                         transition-all duration-150 cursor-pointer
                    {openSteps[id]
                      ? 'border-[#4f46e5] bg-[#eef2ff] text-[#4f46e5]'
                      : 'border-[#e5e7eb] bg-transparent text-[#9ca3af] hover:border-[#4f46e5] hover:text-[#4f46e5]'}"
                  title="Show steps"
                >?</button>
              {/if}

              <!-- Pass / Fail / Skip buttons -->
              <div class="flex gap-1.5">
                {#each ['pass', 'fail', 'skip'] as status}
                  <button
                    onclick={() => toggle(id, status)}
                    title={status.charAt(0).toUpperCase() + status.slice(1)}
                    class="flex h-7 w-7 items-center justify-center rounded-md border text-xs font-semibold
                           transition-all duration-100 cursor-pointer
                      {s === status && status === 'pass' ? 'bg-[#dcfce7] border-[#16a34a] text-[#16a34a]'
                      : s === status && status === 'fail' ? 'bg-[#fee2e2] border-[#dc2626] text-[#dc2626]'
                      : s === status && status === 'skip' ? 'bg-[#fef3c7] border-[#d97706] text-[#d97706]'
                      : 'border-[#e5e7eb] bg-transparent text-[#9ca3af] hover:border-[#6b7280] hover:text-[#6b7280]'}"
                  >
                    {STATUS_SYMBOL[status]}
                  </button>
                {/each}
              </div>
            </div>

            <!-- Steps (collapsible) -->
            {#if openSteps[id] && test.steps?.length}
              <div class="w-full border-t border-dashed border-[#e5e7eb] pt-2 pb-1 pl-1">
                <ol class="list-decimal pl-5 space-y-0.5">
                  {#each test.steps as step}
                    <li class="text-[13px] leading-relaxed text-[#6b7280]">{step}</li>
                  {/each}
                </ol>
              </div>
            {/if}

          </div>
        {/each}
      </div>
    {/each}

    <!-- Actions -->
    <div class="mt-6 flex flex-wrap gap-2">
      <button
        onclick={copyJira}
        class="cursor-pointer rounded-md border px-5 py-[9px] text-[13.5px] font-medium transition-all duration-150
          {copied
            ? 'border-[#16a34a] bg-[#dcfce7] text-[#16a34a] shadow-none'
            : 'border-[#4f46e5] bg-[#4f46e5] text-white shadow-[0_1px_3px_rgb(79_70_229/0.3)] hover:bg-[#4338ca] hover:border-[#4338ca]'}"
      >
        {copied ? '✓ Copied!' : 'Copy for Jira'}
      </button>

      <button
        onclick={reset}
        class="cursor-pointer rounded-md border border-[#e5e7eb] bg-white px-5 py-[9px] text-[13.5px]
               font-medium text-[#6b7280] shadow-sm transition-all duration-150
               hover:border-[#9ca3af] hover:text-[#111827]"
      >
        Reset all
      </button>
    </div>

    <!-- Jira preview -->
    {#if showPreview}
      <div class="mt-5 overflow-hidden rounded-[10px] border border-[#e5e7eb] bg-white shadow-sm">
        <div class="flex items-center justify-between border-b border-[#e5e7eb] bg-[#f9fafb] px-4 py-2.5">
          <span class="text-xs font-medium text-[#6b7280]">Jira comment preview</span>
          <button onclick={() => { showPreview = false; }}
             class="cursor-pointer text-xs font-medium text-[#4f46e5] hover:underline bg-transparent border-0 p-0">hide</button>
        </div>
        <pre class="whitespace-pre-wrap break-words px-4 py-4 font-mono text-[12px] leading-[1.7] text-[#111827]">{previewText}</pre>
      </div>
    {/if}

  </div>
</div>

<!-- Toast -->
<div class="fixed bottom-7 right-6 rounded-md bg-[#1f2937] px-4 py-2.5 text-[13px] font-medium text-white
            shadow-md pointer-events-none transition-all duration-200
  {showToast ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1.5'}">
  Copied to clipboard!
</div>

<style>
  /* Stat chip shared style */
  .stat {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 4px 10px;
    border-radius: 9999px;
    font-size: 12px;
    font-weight: 500;
    border-width: 1px;
    border-style: solid;
    box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  }

  .stat b { font-weight: 600; }
</style>
