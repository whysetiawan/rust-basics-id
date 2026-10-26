// Shared lesson helpers. Static pages, no build.
//
// 1. Translation help:  <p data-id="Teks Indonesia">English text</p>
//    Adds a small "ID" button. Tap shows the Indonesian line. One global toggle: <button data-tr-all>.
// 2. Run bar:  <pre data-run><code>fn main() { ... }</code></pre>
//    Adds Copy, Open Rustfinity, and "code ready" (play.rust-lang.org) buttons.
// 3. Stepper:  <div data-stepper><script type="application/json">{"code":[..], "steps":[..]}</script></div>
//    step = {"line": 0, "print": "text", "boxes": {"name": "value"}, "say": "...", "say_id": "..."}
// 4. Quiz:     <div data-quiz data-lesson="0001"><script type="application/json">[..]</script></div>
//    item = {"q", "q_id", "options": [..], "answer": index, "why", "why_id"}
(function () {
  const RUSTFINITY = 'https://www.rustfinity.com/playground';
  const PLAY = 'https://play.rust-lang.org/?version=stable&mode=debug&edition=2021&code=';

  // Storage can be blocked (private mode). Pages must work without it.
  function store(key, value) {
    try {
      if (value === undefined) return localStorage.getItem(key);
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn('storage unavailable', e);
    }
    return null;
  }

  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  let showAll = false;

  // Indonesian line, hidden unless the global toggle is on.
  function trSpan(text) {
    const tr = el('span', 'tr-text', text);
    tr.hidden = !showAll;
    return tr;
  }

  function trButton(target) {
    const btn = el('button', 'tr-btn', 'ID');
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Lihat arti dalam Bahasa Indonesia');
    btn.addEventListener('click', () => { target.hidden = !target.hidden; });
    return btn;
  }

  // ---------- 1. translation ----------
  function addTranslation(node) {
    const tr = trSpan(node.dataset.id);
    node.appendChild(trButton(tr));
    node.appendChild(tr);
  }

  function setupGlobalToggle(btn) {
    btn.addEventListener('click', () => {
      showAll = !showAll;
      document.querySelectorAll('.tr-text').forEach((t) => { t.hidden = !showAll; });
      btn.textContent = showAll ? 'Hide Indonesian' : 'Show all Indonesian';
    });
  }

  // ---------- 2. run bar ----------
  async function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return;
    }
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(area);
    if (!ok) throw new Error('copy command failed');
  }

  function addRunBar(pre) {
    const code = pre.textContent.replace(/\n$/, '');
    const bar = el('div', 'run-bar');

    const copy = el('button', '', 'Copy');
    copy.type = 'button';
    copy.addEventListener('click', async () => {
      try {
        await copyText(code);
        copy.textContent = 'Copied!';
      } catch (e) {
        console.error('copy failed', e);
        copy.textContent = 'Copy failed. Hold and select the code.';
      }
      setTimeout(() => { copy.textContent = 'Copy'; }, 2500);
    });

    const open = el('a', 'ghost', 'Open Rustfinity');
    open.href = RUSTFINITY;
    open.target = '_blank';
    open.rel = 'noopener';

    const ready = el('a', 'ghost', 'Backup: code ready');
    ready.href = PLAY + encodeURIComponent(code);
    ready.target = '_blank';
    ready.rel = 'noopener';

    bar.append(copy, open, ready);
    pre.after(bar);
  }

  // ---------- 3. stepper ----------
  function renderStepper(root) {
    const data = JSON.parse(root.querySelector('script[type="application/json"]').textContent);
    const lines = el('div', 'code-lines');
    const lineEls = data.code.map((text) => {
      const d = el('div', '', text || ' ');
      lines.appendChild(d);
      return d;
    });
    const boxesLabel = el('div', 'label', 'Boxes (variables)');
    const boxes = el('div', 'boxes');
    const outLabel = el('div', 'label', 'Screen (output)');
    const out = el('div', 'output');
    const say = el('p', 'say');
    const nav = el('div', 'nav');
    const back = el('button', 'btn ghost', 'Back');
    const next = el('button', 'btn', 'Next');
    const count = el('span', 'count');
    back.type = next.type = 'button';
    nav.append(back, next, count);

    const hasBoxes = data.steps.some((s) => s.boxes);
    root.append(lines);
    if (hasBoxes) root.append(boxesLabel, boxes);
    root.append(outLabel, out, say, nav);

    let i = 0;
    function draw() {
      const step = data.steps[i];
      lineEls.forEach((d, n) => d.classList.toggle('now', n === step.line));
      const printed = data.steps.slice(0, i + 1).filter((s) => s.print !== undefined).map((s) => s.print);
      out.textContent = printed.join('\n');
      const prev = i > 0 ? data.steps[i - 1].boxes || {} : {};
      boxes.textContent = '';
      Object.entries(step.boxes || {}).forEach(([name, val]) => {
        const b = el('div', 'box' + (prev[name] !== val ? ' changed' : ''));
        b.append(el('div', 'name', name), el('div', 'val', val));
        boxes.appendChild(b);
      });
      say.textContent = step.say;
      if (step.say_id) {
        const tr = trSpan(step.say_id);
        say.append(trButton(tr), tr);
      }
      count.textContent = 'Step ' + (i + 1) + ' / ' + data.steps.length;
      back.disabled = i === 0;
      next.disabled = i === data.steps.length - 1;
    }
    back.addEventListener('click', () => { i -= 1; draw(); });
    next.addEventListener('click', () => { i += 1; draw(); });
    draw();
  }

  // ---------- 4. quiz ----------
  function renderQuiz(root) {
    const data = JSON.parse(root.querySelector('script[type="application/json"]').textContent);
    const lesson = root.dataset.lesson;
    let answered = 0;
    let correct = 0;
    const score = el('div', 'quiz-score');

    data.forEach((item, qi) => {
      const box = el('div', 'quiz-q');
      const prompt = el('p', 'prompt', (qi + 1) + '. ' + item.q);
      if (item.q_id) {
        const tr = trSpan(item.q_id);
        prompt.append(trButton(tr), tr);
      }
      box.appendChild(prompt);
      const why = el('p', 'why');
      const group = 'q' + qi;

      item.options.forEach((text, oi) => {
        const label = el('label');
        const input = el('input');
        input.type = 'radio';
        input.name = group;
        input.addEventListener('change', () => {
          const isRight = oi === item.answer;
          answered += 1;
          if (isRight) correct += 1;
          label.classList.add(isRight ? 'right' : 'wrong');
          if (!isRight) box.querySelectorAll('label')[item.answer].classList.add('right');
          box.querySelectorAll('input').forEach((x) => { x.disabled = true; });
          why.className = 'why ' + (isRight ? 'ok' : 'bad');
          why.textContent = (isRight ? 'Correct! ' : 'Not quite. ') + item.why;
          if (item.why_id) {
            const tr = trSpan(item.why_id);
            why.append(trButton(tr), tr);
          }
          if (answered < data.length) return;
          score.textContent = 'Score: ' + correct + ' / ' + data.length + (correct === data.length ? '. Perfect!' : '. Good job!');
          if (lesson) store('rust-basics-done-' + lesson, String(correct) + '/' + data.length);
        });
        label.append(input, document.createTextNode(text));
        box.appendChild(label);
      });
      box.appendChild(why);
      root.appendChild(box);
    });
    root.appendChild(score);
  }

  // ---------- index progress ----------
  function markDone(li) {
    const result = store('rust-basics-done-' + li.dataset.lesson);
    if (!result) return;
    const tag = el('span', 'done', '✓ ' + result);
    li.querySelector('a').prepend(tag);
  }

  document.querySelectorAll('[data-id]').forEach(addTranslation);
  document.querySelectorAll('[data-tr-all]').forEach(setupGlobalToggle);
  document.querySelectorAll('pre[data-run]').forEach(addRunBar);
  document.querySelectorAll('[data-stepper]').forEach(renderStepper);
  document.querySelectorAll('[data-quiz]').forEach(renderQuiz);
  document.querySelectorAll('li[data-lesson]').forEach(markDone);
})();
