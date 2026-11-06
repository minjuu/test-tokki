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
// 익명 방문 통계: 테스트 시작과 완료를 따로 센다
const track = name => window.goatcounter?.count?.({ path: name, title: name, event: true });
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
  friend(t, answers) {
    const counts = Object.fromEntries(Object.keys(t.results).map(k => [k, answers.filter(a => a === k).length]));
    const max = Math.max(...Object.values(counts));
    const k = [...answers].reverse().find(a => counts[a] === max);
    return {...t.results[k],label:'나와 특히 안 맞는 유형',num:max,unit:' / 3',sub:'이 유형이 나온 세 장면 중 선택한 횟수',goodTitle:'특히 불편했던 순간',good:t.items.flatMap((q,i)=>answers[i]===k?[q.o.find(o=>o[1]===k)[0]]:[]),tipTitle:'이렇게 말해봐요',note:'친구의 성격을 단정하는 결과가 아니라, 내가 중요하게 여기는 관계의 기준이에요.'};
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
// 원본 파일은 유지하고 그림 주변의 빈 여백만 뷰박스로 정리한다.
const artFrames = {
  empathy: [561,478,97,112,332,328], iq: [736,736,20,13,667,732],
  friend: [1080,1080,76,94,953,923], attach: [735,470,29,53,678,375],
  love: [1199,1109,68,180,1067,766],
};
const testArt = key => {
  const [w,h,x,y,vw,vh] = artFrames[key];
  const ratio = Math.sqrt(vw/vh);
  return `<svg class="test-art" aria-hidden="true" focusable="false" style="width:${ratio}em;height:${1/ratio}em" viewBox="${x} ${y} ${vw} ${vh}"><image href="test-art/${key}.png" width="${w}" height="${h}"/></svg>`;
};
const cardsHtml = skip => Object.entries(TESTS).filter(([k]) => k !== skip).map(([k, t]) => `
  <a class="tcard" href="#/t/${k}">
    <span class="tcard-ico">${k === "chiikawa" ? portrait("chi") : testArt(k)}</span>
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
      ${key === "chiikawa" ? friends() : `<div class="big-ico">${testArt(key)}</div>`}
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
  track(`시작-${key}`);
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
  track(`완료-${key}`);
  result(key, r, encodeAns(t, ans));
}

function result(key, r, code, shared) {
  const t = TESTS[key];
  app.innerHTML = `
    <section class="card res-head">
      ${r.portraitKey ? `<div class="friend-result">${portrait(r.portraitKey)}</div>` : `<div class="big-ico">${testArt(key)}</div>`}
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
    <section class="card"><h2>${r.tipTitle || '이렇게 해보세요'}</h2><ul>${r.tip.map(x => `<li>${x}</li>`).join('')}</ul></section>
    ${r.note ? `<p class="note">${r.note}</p>` : ''}
    <div style="margin-top:14px">
      <button class="primary" id="save">결과 이미지 저장</button>
      <button class="ghost" id="share">결과 공유하기</button>
      <button class="ghost" id="again">${shared ? '나도 해보기' : '다시 하기'}</button>
    </div>
    <p class="sec-title">다른 테스트도 해보세요</p>
    <div class="tcards">${cardsHtml(key)}</div>`;
  window.scrollTo(0, 0);
  document.getElementById('again').onclick = () => start(key);
  document.getElementById('save').onclick = e => saveImage(e.currentTarget, key, r);
  document.getElementById('share').onclick = async () => {
    const url = `${location.origin}${location.pathname}#/r/${key}/${code}`;
    const text = `${t.title} 결과: ${r.name} ${r.num}${r.unit}`;
    try {
      if (navigator.share) return await navigator.share({ title: '오늘의테스트', text, url });
    } catch (e) {
      if (e.name === 'AbortError') return;
    }
    toast(await copyText(`${text}\n${url}`) ? '결과 링크를 복사했어요' : '복사하지 못했어요');
  };
}

// 답안을 문항별 선택지 번호로 줄여서 결과 링크에 담는다
const optValue = o => Array.isArray(o) ? o[1] : o;
const encodeAns = (t, ans) => t.items.map((q, i) => {
  const x = q.o.findIndex(o => optValue(o) === ans[i]);
  return x < 0 ? 'x' : x;
}).join('');
function decodeAns(t, code) {
  if (!code || code.length !== t.items.length) return null;
  const ans = t.items.map((q, i) => code[i] === 'x' ? undefined : q.o[+code[i]] === undefined ? null : optValue(q.o[+code[i]]));
  if (ans.includes(null) || (t.kind === 'choice' && ans.includes(undefined))) return null;
  return ans;
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const el = document.createElement('textarea');
    el.value = text;
    document.body.append(el);
    el.select();
    const ok = document.execCommand('copy');
    el.remove();
    return ok;
  }
}

function wrapText(ctx, text, width, maxLines) {
  const lines = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > width && line) { lines.push(line); line = word; } else line = next;
  }
  lines.push(line);
  if (lines.length > maxLines) {
    lines.length = maxLines;
    lines[maxLines - 1] += '…';
  }
  return lines;
}

const loadImage = src => new Promise((ok, fail) => {
  const img = new Image();
  img.onload = () => ok(img);
  img.onerror = fail;
  img.src = src;
});

// 결과 화면의 내용을 세로로 긴 이미지 한 장에 그린다
async function resultCanvas(key, r) {
  const W = 1080, L = 120, TW = W - L * 2, font = "'Apple SD Gothic Neo', 'Pretendard', sans-serif";
  const src = r.portraitKey ? `portraits/${r.portraitKey}.webp` : `test-art/${key}.png`;
  const art = await loadImage(src).catch(() => null);
  await document.fonts?.ready;
  const paint = (ctx, H) => {
    const set = (size, weight, color, align = 'left') => {
      ctx.font = `${weight} ${size}px ${font}`;
      ctx.fillStyle = color;
      ctx.textAlign = align;
    };
    const center = (text, y, size, weight, color) => {
      set(size, weight, color, 'center');
      ctx.fillText(text, W / 2, y);
    };
    const para = (text, y, x = L, width = TW) => {
      set(34, 500, '#333d4b');
      for (const line of wrapText(ctx, text, width, Infinity)) {
        ctx.fillText(line, x, y);
        y += 52;
      }
      return y;
    };
    const heading = (text, y) => {
      set(38, 800, '#191f28');
      ctx.fillText(text, L, y);
      return y + 62;
    };
    const bullets = (list, y) => {
      for (const item of list) {
        set(34, 500, '#333d4b');
        ctx.fillText('•', L, y);
        y = para(item, y, L + 34, TW - 34) + 10;
      }
      return y;
    };
    ctx.fillStyle = '#f2f4f6';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(60, 60, W - 120, H - 120, 48); else ctx.rect(60, 60, W - 120, H - 120);
    ctx.fill();
    center(TESTS[key].title, 160, 36, 700, '#6b7684');
    if (art) {
      const k = Math.min(280 / art.width, 280 / art.height);
      ctx.drawImage(art, W / 2 - art.width * k / 2, 340 - art.height * k / 2, art.width * k, art.height * k);
    } else if (r.mark) center(r.mark, 400, 180, 400, '#191f28');
    center(r.label, 540, 34, 500, '#6b7684');
    center(r.name, 625, 68, 800, '#191f28');
    center(`${r.num}${r.unit}`, 745, 92, 800, '#191f28');
    let y = 800;
    if (r.sub) { center(r.sub, y, 30, 500, '#6b7684'); y += 40; }
    y = para(r.sum, y + 50) + 44;
    if (r.bars) {
      y = heading('영역별 점수', y);
      for (const [name, v] of r.bars) {
        set(32, 600, '#191f28');
        ctx.fillText(name, L, y);
        set(32, 700, '#191f28', 'right');
        ctx.fillText(v, W - L, y);
        ctx.fillStyle = '#e8ebef';
        ctx.fillRect(L, y + 18, TW, 14);
        ctx.fillStyle = '#191f28';
        ctx.fillRect(L, y + 18, TW * v / 100, 14);
        y += 78;
      }
      y += 30;
    }
    y = bullets(r.good, heading(r.goodTitle || '이런 점이 좋아요', y)) + 34;
    if (r.match) y = para(r.match, heading('잘 맞는 사람', y)) + 44;
    y = bullets(r.tip, heading(r.tipTitle || '이렇게 해보세요', y)) + 40;
    if (r.note) y = para(r.note, y) + 32;
    center('오늘의테스트', y + 20, 32, 800, '#191f28');
    return y + 110;
  };
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = 1;
  canvas.height = paint(canvas.getContext('2d'), 1);
  paint(canvas.getContext('2d'), canvas.height);
  return canvas;
}

function showImage(url) {
  const el = document.createElement('div');
  el.className = 'overlay';
  el.innerHTML = `<img src="${url}" alt="결과 이미지"><p>이미지를 길게 눌러 저장해 주세요</p><button class="ghost">닫기</button>`;
  el.querySelector('button').onclick = () => el.remove();
  document.body.append(el);
}

async function saveImage(btn, key, r) {
  btn.disabled = true;
  try {
    const canvas = await resultCanvas(key, r);
    const blob = await new Promise(ok => canvas.toBlob(ok, 'image/png'));
    const name = `오늘의테스트-${r.name}.png`;
    const file = new File([blob], name, { type: 'image/png' });
    const touch = matchMedia('(pointer: coarse)').matches;
    if (touch && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file] });
      } catch (e) {
        if (e.name !== 'AbortError') showImage(canvas.toDataURL('image/png'));
      }
    } else if (touch) {
      showImage(canvas.toDataURL('image/png'));
    } else {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      toast('이미지를 저장했어요');
    }
  } catch {
    toast('이미지를 만들지 못했어요');
  } finally {
    btn.disabled = false;
  }
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
  const [, page, key, code] = location.hash.split('/');
  if (page === 't' && key === 'mental') { location.replace('#/t/friend'); return; }
  const ans = page === 'r' && TESTS[key] ? decodeAns(TESTS[key], code) : null;
  if (ans) result(key, SCORE[key](TESTS[key], ans), code, true);
  else if ((page === 't' || page === 'r') && TESTS[key]) intro(key);
  else home();
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', route);
route();
