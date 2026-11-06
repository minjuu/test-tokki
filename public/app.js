const app = document.getElementById('app');
const TESTS = { chiikawa: window.TESTS.chiikawa, ...window.TESTS };
let run = null; // { key, i, answers, deadline, timer }

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const shuffle = a => {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
};
const pct = (sum, n) => Math.round(sum / n * 100);

// 채점: 답안을 받아 결과 객체를 돌려줘요
const SCORE = {
  chiikawa(t, answers) {
    const counts = Object.fromEntries(Object.keys(t.profiles).map(k => [k, answers.filter(a => a === k).length]));
    // 동점이면 마지막 장면부터 돌아보며 동점 캐릭터에 해당하는 가장 최근 선택을 사용한다.
    const max = Math.max(...Object.values(counts));
    const key = [...answers].reverse().find(k => counts[k] === max);
    return { ...t.profiles[key], portraitKey:key, label: '나랑 닮은 먼작귀 친구', num: max, unit: ' / ' + answers.length,
      sub: '닮은 선택', goodTitle: '이 선택에서 닮았어요', good: t.items.flatMap((q,i) => answers[i] === key ? [q.o.find(o => o[1] === key)[0]] : []),
      note: '오늘의 선택으로 보는 비공식 팬 테스트예요.' };
  },
  love(t, ans) {
    const c = Object.fromEntries(Object.keys(t.results).map(k => [k, 0]));
    ans.forEach(k => c[k]++);
    const top = Object.entries(c).sort((a, b) => b[1] - a[1]);
    const pc = v => Math.round(v / (ans.length / 2) * 100); // 한 유형은 문항의 절반에만 나온다
    return { ...t.results[top[0][0]], label: '나의 연애 유형', num: pc(top[0][1]), unit: '%', sub: '이 유형과 닮은 정도',
      bars: top.map(([k, v]) => [t.results[k].name, pc(v)]) };
  },
  empathy(t, ans) {
    const dims = {};
    t.items.forEach((q, i) => {
      (dims[q.d] ||= []).push(ans[i]);
    });
    const bars = Object.entries(dims).map(([k, v]) => [t.dims[k], pct(v.reduce((a, b) => a + b, 0), v.length)]);
    const total = Math.round(bars.reduce((a, b) => a + b[1], 0) / bars.length);
    return { ...t.results.find(r => total >= r.min), label: '나의 공감 유형', num: total, unit: '점', bars };
  },
  iq(t, ans) {
    const correct = t.items.filter((q, i) => ans[i] === q.a).length;
    const iq = Math.max(70, Math.round(70 + correct / t.items.length * 70));
    return { ...t.results.find(r => iq >= r.min), label: '나의 두뇌 유형', num: iq, unit: '', sub: `${t.items.length}문제 중 ${correct}문제 정답`,
      note: '이 사이트에서 만든 재미용 추정치예요. 공인 지능검사 결과가 아니에요.' };
  },
  mental(t, ans) {
    const age = Math.round(ans.reduce((a, b) => a + b, 0) / ans.length);
    return { ...t.results.find(r => age >= r.min), label: '나의 정신연령', num: age, unit: '세' };
  },
  attach(t, ans) {
    const sum = { anx: 0, avo: 0 }, n = { anx: 0, avo: 0 };
    t.items.forEach((q, i) => { sum[q.d] += ans[i]; n[q.d]++; });
    const anx = pct(sum.anx, n.anx), avo = pct(sum.avo, n.avo);
    const key = anx < 50 ? (avo < 50 ? 'secure' : 'avoidant') : (avo < 50 ? 'anxious' : 'fearful');
    const stable = 100 - Math.round((anx + avo) / 2);
    return { ...t.results[key], label: '나의 애착 유형', num: stable, unit: '%', sub: '안정 지수',
      bars: [['불안', anx], ['회피', avo]], note: '자기 보고로 경향만 살펴보는 테스트예요. 진단이 아니에요.' };
  },
};

const portraitSources = {"chi": "https://www.pinterest.com/ideas/chiikawa-transparent-png/896191911143/", "hachi": "https://www.pinterest.com/pin/hachiware-in-2024--864480091006382750/", "usa": "https://www.pinterest.com/ideas/usagi-chiikawa-icon/893846314408/", "momo": "https://www.pinterest.com/ideas/momonga-chiikawa-pfp/931594906362/", "kuri": "https://fr.pinterest.com/pin/chikawaii--138345019797394918/", "rakko": "https://www.pinterest.com/ideas/chiikawa-rakko/910219186587/", "shisa": "https://www.chiikawaofficial.com/"};
const portrait = (k) => `<img class="friend-face" src="portraits/${k}.webp" alt="${TESTS.chiikawa.profiles[k].name}">`;
const friends = () => `<div class="friend-line">${Object.keys(portraitSources).map(portrait).join('')}</div>`;
const cardsHtml = skip => Object.entries(TESTS).filter(([k]) => k !== skip).map(([k, t]) => `
  <a class="tcard" href="#/t/${k}">
    <span class="tcard-ico">${k === "chiikawa" ? portrait("chi") : t.mark}</span>
    <b>${t.title}</b>
    <small>${t.desc}</small>
  </a>`).join('');

function home() {
  app.innerHTML = `
    <section class="hero"><h1>오늘의 나를<br>알아보는 시간</h1><p>궁금한 테스트를 골라보세요.</p></section>
    <div class="tcards">${cardsHtml()}</div>`;
}

function intro(key) {
  const t = TESTS[key];
  app.innerHTML = `
    <a class="back" href="#/">← 홈</a>
    <section class="card intro">
      ${key === "chiikawa" ? friends() : `<div class="big-ico">${t.mark}</div>`}
      <h1>${t.title}</h1>
      <p>${t.intro}</p>
      <p class="meta">${t.kind === 'quiz' ? t.time : `${t.items.length}문항 · ${t.time}`}</p>
      <button class="primary" id="start">시작하기</button>
    </section>`;
  document.getElementById('start').onclick = () => start(key);
}

function start(key) {
  stopTimer();
  const t = TESTS[key];
  run = { key, i: 0, answers: [], items: t.items.map(q => ({ ...q, o: shuffle(q.o) })) };
  if (t.limit) {
    run.deadline = Date.now() + t.limit * 1000;
    run.timer = setInterval(tick, 1000);
  }
  question();
}

function stopTimer() { if (run?.timer) clearInterval(run.timer); }
function tick() {
  const left = Math.max(0, Math.ceil((run.deadline - Date.now()) / 1000));
  const el = document.getElementById('left');
  if (el) el.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
  if (!left) finish();
}

function question() {
  const t = TESTS[run.key], q = run.items[run.i], n = run.items.length;
  const opts = t.kind === 'choice' ? q.o : q.o.map(o => [o, o]);
  const picked = run.answers[run.i];
  app.innerHTML = `
    <section class="card">
      <div class="progress-top"><span>${run.i + 1} / ${n}</span>${t.limit ? '<span id="left"></span>' : ''}</div>
      <div class="progress"><i style="width:${run.i / n * 100}%"></i></div>
      <p class="q">${esc(q.t)}</p>
      ${q.g ? `<div class="grid">${q.g.map(c => `<span>${esc(c)}</span>`).join('')}</div>` : ''}
      <div class="opts">${opts.map(([label, v], i) => `<button class="opt${picked === v ? ' on' : ''}" data-i="${i}">${esc(label)}</button>`).join('')}</div>
      ${run.i ? '<button class="prev" id="prev">← 이전 문항</button>' : ''}
    </section>`;
  if (t.limit) tick();
  app.querySelectorAll('.opt').forEach(b => b.onclick = () => {
    if (run.locked) return;
    run.locked = true;
    b.classList.add('on');
    run.answers[run.i] = opts[+b.dataset.i][1];
    setTimeout(() => {
      run.locked = false;
      if (!run) return;
      if (++run.i < n) question(); else finish();
    }, 160);
  });
  const prev = document.getElementById('prev');
  if (prev) prev.onclick = () => { run.i--; question(); };
  window.scrollTo(0, 0);
}

function finish() {
  stopTimer();
  const t = TESTS[run.key], key = run.key;
  // 문항 순서를 섞었으니 원래 순서로 되돌려 채점해요
  const ans = t.items.map(q => run.answers[run.items.findIndex(x => x.t === q.t)]);
  const r = SCORE[key](t, ans);
  run = null;
  result(key, r);
}

function result(key, r) {
  const t = TESTS[key];
  app.innerHTML = `
    <section class="card res-head">
      ${r.portraitKey ? `<div class="friend-result">${portrait(r.portraitKey)}<a href="${portraitSources[r.portraitKey]}" target="_blank" rel="noopener noreferrer">이미지 출처 ↗</a></div>` : `<div class="big-ico">${r.mark}</div>`}
      <p class="res-label">${r.label}</p>
      <h1>${r.name}</h1>
      <p class="res-num">${r.num}<small>${r.unit}</small></p>
      ${r.sub ? `<p class="res-sub">${r.sub}</p>` : ''}
    </section>
    <section class="card"><p class="body">${r.sum}</p></section>
    ${r.bars ? `<section class="card"><h2>영역별 점수</h2>${r.bars.map(([n, v]) => `
      <div class="bar"><div class="bar-top"><span>${n}</span><em>${v}</em></div><div class="bar-track"><i style="width:${v}%"></i></div></div>`).join('')}</section>` : ''}
    <section class="card"><h2>${r.goodTitle || '이런 점이 좋아요'}</h2><ul>${r.good.map(x => `<li>${x}</li>`).join('')}</ul></section>
    ${r.match ? `<section class="card"><h2>잘 맞는 사람</h2><p class="body">${r.match}</p></section>` : ''}
    <section class="card"><h2>이렇게 해보세요</h2><ul>${r.tip.map(x => `<li>${x}</li>`).join('')}</ul></section>
    ${r.note ? `<p class="note">${r.note}</p>` : ''}
    <div style="margin-top:14px">
      <button class="primary" id="share">결과 공유하기</button>
      <button class="ghost" id="again">다시 하기</button>
    </div>
    <p class="sec-title">다른 테스트도 해보세요</p>
    <div class="tcards">${cardsHtml(key)}</div>`;
  window.scrollTo(0, 0);
  document.getElementById('again').onclick = () => start(key);
  document.getElementById('share').onclick = async () => {
    const url = `${location.origin}${location.pathname}#/t/${key}`;
    const text = `${t.title} 결과: ${r.name} ${r.num}${r.unit}`;
    try {
      if (navigator.share) return await navigator.share({ title: '오늘의테스트', text, url });
      await navigator.clipboard.writeText(`${text}\n${url}`);
      toast('결과를 복사했어요');
    } catch (e) {
      if (e.name !== 'AbortError') toast('복사하지 못했어요');
    }
  };
}

function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.append(el);
  setTimeout(() => el.remove(), 1800);
}

function route() {
  stopTimer();
  run = null;
  const [, page, key] = location.hash.split('/');
  if (page === 't' && TESTS[key]) intro(key); else home();
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', route);
route();
