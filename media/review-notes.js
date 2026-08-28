/*!
 * review-notes.js — 리포트 검토용 인라인 코멘트 도구
 *
 * 페이지 본문에서 텍스트를 드래그하면 자체 팝업이 떠서 코멘트를 남길 수 있고,
 * 우측 하단 패널에서 목록 확인·개별/전체 삭제·코멘트 복사를 할 수 있다.
 * CSS 를 스스로 주입하므로 이 파일 하나만 붙이면 어떤 HTML 에서도 동작한다.
 *
 *   <script src="assets/review-notes.js" defer></script>
 *
 * 남긴 내용은 localStorage 에 페이지 경로별로 저장되어 새로고침해도 남는다.
 * 위치는 '본문에서 그 문구가 몇 번째로 나오는지'로 기억하므로, 본문이 바뀌면
 * 해당 코멘트는 하이라이트 없이 목록에만 남는다.
 */
(function () {
  'use strict';
  if (window.__reviewNotesLoaded) return;
  window.__reviewNotesLoaded = true;

  var CSS = `  mark[data-note-id] { background: #e8e3d3; box-shadow: inset 0 -2px 0 #b8ae93; cursor: pointer; }
  mark[data-note-id]:hover { background: #dcd5bd; }
  mark[data-note-id].rp-flash { animation: rp-flash-anim 1s ease; }
  @keyframes rp-flash-anim {
    0%, 100% { background: #e8e3d3; }
    30% { background: #ffe58a; }
  }

  /* 코멘트 패널 — 머리말과 버튼이 한 장의 카드로 보이도록 묶는다. */
  /* 평소엔 반투명하게 비켜 있다가, 마우스를 올리면 또렷해진다. */
  #reviewPanel { position: fixed; bottom: 16px; right: 16px; z-index: 9999;
    width: 230px; max-height: 55vh; display: flex; flex-direction: column;
    border-radius: 10px; overflow: hidden; background: #fff;
    box-shadow: 0 6px 20px rgba(15,23,42,.18), 0 0 0 1px rgba(15,23,42,.08);
    font: 12px/1.45 system-ui, -apple-system, "Malgun Gothic", sans-serif;
    opacity: .72; transition: opacity .15s, box-shadow .15s; }
  #reviewPanel:hover, #reviewPanel:focus-within { opacity: 1;
    box-shadow: 0 10px 28px rgba(15,23,42,.24), 0 0 0 1px rgba(15,23,42,.1); }
  #reviewPanel.collapsed { width: 138px; }

  #reviewPanel .rp-head { display: flex; gap: 6px; align-items: center;
    background: #3f4854; color: #f3f4f6; padding: 7px 10px;
    font-weight: 600; letter-spacing: .1px; cursor: pointer; user-select: none; }
  #reviewPanel .rp-head:hover { background: #4a5462; }
  #reviewPanel .rp-head span { flex: 1; white-space: nowrap; }
  #reviewPanel .rp-head i { font-style: normal; opacity: .75; }
  #reviewPanel .rp-head .rp-count { font-variant-numeric: tabular-nums; }
  #reviewPanel .rp-head button { background: none; border: none; color: inherit;
    opacity: .7; cursor: pointer; font-size: 10px; padding: 2px; line-height: 1; }
  #reviewPanel .rp-head button:hover { opacity: 1; }

  #reviewPanel .rp-body { background: #fff; overflow-y: auto; }
  #reviewPanel.collapsed .rp-body { display: none; }
  #reviewPanel .rp-empty { padding: 12px 10px; color: #8b939e; }
  #reviewPanel .rp-item { display: flex; gap: 6px; padding: 7px 10px;
    border-bottom: 1px solid #f0f1f3; cursor: pointer; }
  #reviewPanel .rp-item:last-child { border-bottom: none; }
  #reviewPanel .rp-item:hover { background: #f7f8fa; }
  #reviewPanel .rp-item > div { flex: 1; min-width: 0; }
  #reviewPanel .rp-orig { color: #8b939e; font-size: 11px; overflow: hidden;
    text-overflow: ellipsis; white-space: nowrap; }
  #reviewPanel .rp-ins { color: #1f2430; }
  #reviewPanel .rp-del { background: none; border: none; color: #b9c0c9;
    cursor: pointer; align-self: flex-start; line-height: 1; padding: 3px 4px;
    border-radius: 4px; font-size: 12px; }
  #reviewPanel .rp-del:hover { background: #fdecec; color: #c0392b; }

  #reviewPanel .rp-foot { display: flex; background: #fff; border-top: 1px solid #eceef1; }
  /* 접혀 있어도 코멘트가 있으면 복사 버튼은 남겨 둔다. */
  #reviewPanel.collapsed:not(.has-notes) .rp-foot { display: none; }
  #reviewPanel.collapsed .rp-clear { display: none; }
  #reviewPanel .rp-foot button { flex: 1; padding: 9px 6px; border: none; cursor: pointer;
    background: none; font: inherit; font-weight: 600; color: #5b6472; }
  #reviewPanel .rp-foot button:hover { background: #f1f3f6; color: #1f2430; }
  #reviewPanel .rp-foot button.rp-clear { flex: 0 0 auto; padding: 9px 12px;
    color: #97a0ac; border-right: 1px solid #eceef1; font-weight: 500; }
  #reviewPanel .rp-foot button.rp-clear:hover { background: #fdecec; color: #c0392b; }
  #reviewPanel .rp-foot button.rp-copy { color: #1f2430; }

  /* 자체 팝업(시스템 prompt/alert 대체) */
  #rpModal { position: fixed; inset: 0; z-index: 10000; display: flex;
    align-items: center; justify-content: center; background: rgba(0,0,0,.35);
    font: 14px/1.6 system-ui, -apple-system, "Malgun Gothic", sans-serif; }
  #rpModal[hidden] { display: none; }
  #rpModal .rp-dlg { background: #fff; border-radius: 10px; width: min(520px, 92vw);
    box-shadow: 0 10px 40px rgba(0,0,0,.3); overflow: hidden; }
  #rpModal .rp-quote { padding: 12px 16px; background: #f4f5f7; border-bottom: 1px solid #dfe3e8;
    color: #444c56; max-height: 120px; overflow: auto; white-space: pre-wrap; font-size: 13px; }
  #rpModal .rp-label { padding: 12px 16px 0; font-weight: bold; }
  #rpModal .rp-input { margin: 8px 16px 0; width: calc(100% - 32px); box-sizing: border-box;
    min-height: 76px; padding: 8px 10px; border: 1px solid #d0d7de; border-radius: 6px;
    font: inherit; resize: vertical; }
  #rpModal .rp-btns { display: flex; gap: 8px; justify-content: flex-end; padding: 12px 16px 16px; }
  #rpModal .rp-btns button { padding: 7px 14px; border-radius: 6px; cursor: pointer;
    border: 1px solid #d0d7de; background: #fff; font: inherit; }
  #rpModal .rp-btns button.rp-ok { background: #374151; color: #fff; border-color: #374151; font-weight: bold; }
  #rpModal .rp-btns button.rp-danger { color: #b00; }
  #rpModal .rp-hint { padding: 0 16px; color: #888; font-size: 12px; }

  /* 토스트(alert 대체) */
  #rpToast { position: fixed; left: 50%; bottom: 32px; transform: translateX(-50%);
    background: #222; color: #fff; padding: 10px 18px; border-radius: 8px; z-index: 10001;
    font: 13px/1.5 system-ui, -apple-system, "Malgun Gothic", sans-serif;
    opacity: 0; transition: opacity .2s; pointer-events: none; }
  #rpToast.show { opacity: .95; }

  @media print { #reviewPanel, #rpModal, #rpToast { display: none !important; } }`;

  function init() {
    var styleEl = document.createElement('style');
    styleEl.textContent = CSS;
    document.head.appendChild(styleEl);

    setup();
  }

  function setup() {
    const notes = [];
    let seq = 0;

    // ── 자체 팝업 ─────────────────────────────────────────────
    const modal = document.createElement('div');
    modal.id = 'rpModal';
    modal.hidden = true;
    modal.innerHTML =
      '<div class="rp-dlg" role="dialog" aria-modal="true">' +
      '<div class="rp-quote"></div>' +
      '<div class="rp-label"></div>' +
      '<textarea class="rp-input"></textarea>' +
      '<div class="rp-hint">Ctrl+Enter 확인 · Esc 취소</div>' +
      '<div class="rp-btns">' +
      '<button class="rp-remove rp-danger">삭제</button>' +
      '<button class="rp-cancel">취소</button>' +
      '<button class="rp-ok">확인</button>' +
      '</div>' +
      '</div>';
    document.body.appendChild(modal);

    const mQuote = modal.querySelector('.rp-quote');
    const mLabel = modal.querySelector('.rp-label');
    const mInput = modal.querySelector('.rp-input');
    const mHint = modal.querySelector('.rp-hint');
    const mRemove = modal.querySelector('.rp-remove');
    const mCancel = modal.querySelector('.rp-cancel');
    const mOk = modal.querySelector('.rp-ok');
    let resolveModal = null;

    function closeModal(value) {
      modal.hidden = true;
      const r = resolveModal;
      resolveModal = null;
      if (r) r(value);
    }

    // opts: { quote, label, value, showInput, showRemove, okText }
    function openModal(opts) {
      if (resolveModal) closeModal(null);   // 열려 있던 팝업은 취소 처리
      mQuote.textContent = opts.quote || '';
      mQuote.style.display = opts.quote ? '' : 'none';
      mLabel.textContent = opts.label || '';
      const withInput = opts.showInput !== false;
      mInput.style.display = mHint.style.display = withInput ? '' : 'none';
      mInput.value = opts.value || '';
      mRemove.style.display = opts.showRemove ? '' : 'none';
      mOk.textContent = opts.okText || '확인';
      modal.hidden = false;
      if (withInput) { mInput.focus(); mInput.select(); } else { mOk.focus(); }
      return new Promise(res => { resolveModal = res; });
    }

    mOk.onclick = () => closeModal(mInput.style.display === 'none' ? true : mInput.value.trim());
    mCancel.onclick = () => closeModal(null);
    mRemove.onclick = () => closeModal('__remove__');
    modal.addEventListener('mousedown', (e) => { if (e.target === modal) closeModal(null); });
    modal.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); closeModal(null); }
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); mOk.click(); }
    });

    const toast = document.createElement('div');
    toast.id = 'rpToast';
    document.body.appendChild(toast);
    let toastTimer = null;
    function showToast(msg) {
      toast.textContent = msg;
      toast.classList.add('show');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
    }

    // ── 패널 UI ───────────────────────────────────────────────
    const panel = document.createElement('div');
    panel.id = 'reviewPanel';
    panel.innerHTML =
      '<div class="rp-head"><span>📝 코멘트 <b class="rp-count">0</b><i>건</i></span>' +
      '<button class="rp-toggle">▲</button></div>' +
      '<div class="rp-body"></div>' +
      '<div class="rp-foot"><button class="rp-clear">비우기</button>' +
      '<button class="rp-copy">코멘트 복사</button></div>';
    document.body.appendChild(panel);

    const listEl = panel.querySelector('.rp-body');
    const countEl = panel.querySelector('.rp-count');
    const toggleBtn = panel.querySelector('.rp-toggle');

    // 기본은 접힌 상태. 머리말 어디를 눌러도 펼쳐진다.
    panel.classList.add('collapsed');

    function setCollapsed(on) {
      panel.classList.toggle('collapsed', on);
      toggleBtn.textContent = on ? '▲' : '▼';
    }
    panel.querySelector('.rp-head').onclick = () => {
      setCollapsed(!panel.classList.contains('collapsed'));
    };

    function render() {
      countEl.textContent = notes.length;
      panel.classList.toggle('has-notes', notes.length > 0);
      listEl.innerHTML = '';
      if (!notes.length) {
        listEl.innerHTML = '<div class="rp-empty">본문에서 텍스트를 드래그해 메모를 남기세요.</div>';
        return;
      }
      notes.forEach((n, i) => {
        const row = document.createElement('div');
        row.className = 'rp-item';
        const info = document.createElement('div');
        const orig = document.createElement('div');
        orig.className = 'rp-orig';
        // 본문에서 위치를 못 찾은 코멘트는 표시해 둔다.
        orig.textContent = (i + 1) + '. ' + (n.mark ? '' : '⚠ ') + '"' + n.display + '"';
        if (!n.mark) orig.title = '본문이 바뀌어 이 문구를 찾지 못했습니다.';
        const ins = document.createElement('div');
        ins.className = 'rp-ins';
        ins.textContent = n.instruction;
        info.append(orig, ins);
        const del = document.createElement('button');
        del.className = 'rp-del';
        del.textContent = '✕';
        del.title = '이 코멘트 삭제';
        del.onclick = (e) => { e.stopPropagation(); removeNote(n.id); };
        row.append(info, del);
        row.onclick = () => {
          if (!n.mark) { showToast('본문에서 이 코멘트의 위치를 찾지 못했습니다.'); return; }
          n.mark.scrollIntoView({ behavior: 'smooth', block: 'center' });
          n.mark.classList.remove('rp-flash');
          void n.mark.offsetWidth; // 재실행을 위해 리플로우 강제
          n.mark.classList.add('rp-flash');
        };
        listEl.appendChild(row);
      });
    }

    // ── 저장/복원 (localStorage) ───────────────────────────────
    // 페이지마다 따로 저장한다. file:// 로 열면 경로가 곧 구분자다.
    const STORE_KEY = 'reviewNotes:v2:' + location.pathname;

    function save() {
      try {
        if (!notes.length) { localStorage.removeItem(STORE_KEY); return; }
        localStorage.setItem(STORE_KEY, JSON.stringify(
          notes.map(n => ({ id: n.id, original: n.original, display: n.display,
                            instruction: n.instruction, occ: n.occ }))
        ));
      } catch (err) {
        /* 사생활 보호 모드 등 저장이 막힌 환경 */
      }
    }

    // 본문 텍스트 노드만 모은다(도구 UI·스크립트는 제외).
    function contentTextNodes() {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
        acceptNode(n) {
          if (!n.nodeValue) return NodeFilter.FILTER_REJECT;
          const el = n.parentElement;
          if (!el || el.closest('#reviewPanel, #rpModal, #rpToast, script, style, noscript')) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        },
      });
      const out = [];
      let n;
      while ((n = walker.nextNode())) out.push(n);
      return out;
    }

    // 같은 문구가 여러 번 나올 수 있으므로 '몇 번째 등장인지'를 위치 기억용 열쇠로 쓴다.
    function countUpTo(haystack, needle) {
      let c = 0, i = haystack.indexOf(needle);
      while (i !== -1) { c++; i = haystack.indexOf(needle, i + 1); }
      return c;
    }

    function occurrenceOf(range, text) {
      const pre = document.createRange();
      pre.setStart(document.body, 0);
      pre.setEnd(range.startContainer, range.startOffset);
      return countUpTo(pre.toString() + text, text);
    }

    // occ 번째 등장 위치를 다시 찾아 Range 로 돌려준다(못 찾으면 null).
    function rangeForOccurrence(text, occ) {
      const nodes = contentTextNodes();
      let full = '';
      const starts = [];
      for (const n of nodes) { starts.push(full.length); full += n.nodeValue; }

      let at = -1;
      for (let k = 0, i = full.indexOf(text); k < occ && i !== -1; k++) {
        at = i;
        i = full.indexOf(text, i + 1);
      }
      if (at < 0) return null;

      const locate = (offset) => {
        // offset 이 걸치는 텍스트 노드를 이진탐색 대신 단순 탐색으로 찾는다.
        for (let j = nodes.length - 1; j >= 0; j--) {
          if (starts[j] <= offset) return { node: nodes[j], offset: offset - starts[j] };
        }
        return null;
      };
      const a = locate(at), b = locate(at + text.length);
      if (!a || !b) return null;
      const r = document.createRange();
      try {
        r.setStart(a.node, a.offset);
        r.setEnd(b.node, b.offset);
      } catch (err) {
        return null;
      }
      return r;
    }

    // 앞뒤 공백을 범위 밖으로 밀어낸다(경계가 텍스트 노드일 때만).
    function trimRange(r) {
      for (let i = 0; i < 500; i++) {
        const c = r.startContainer;
        if (c.nodeType === 3 && r.startOffset < c.nodeValue.length &&
            /\s/.test(c.nodeValue[r.startOffset])) { r.setStart(c, r.startOffset + 1); }
        else break;
      }
      for (let i = 0; i < 500; i++) {
        const c = r.endContainer;
        if (c.nodeType === 3 && r.endOffset > 0 &&
            /\s/.test(c.nodeValue[r.endOffset - 1])) { r.setEnd(c, r.endOffset - 1); }
        else break;
      }
      return r;
    }

    // 목록·팝업·복사문에 쓸 한 줄짜리 문구.
    function collapse(text) { return text.replace(/\s+/g, ' ').trim(); }

    // 범위 안의 노드를 그대로 <mark> 로 옮겨 담는다.
    // textContent 로 갈아끼우면 줄바꿈·태그가 사라져 본문 텍스트가 달라지고,
    // 그러면 다음 번 복원 때 같은 문구를 못 찾는다.
    function wrap(range, id, title) {
      const mark = document.createElement('mark');
      mark.dataset.noteId = id;
      mark.title = title;
      mark.appendChild(range.extractContents());
      range.insertNode(mark);
      return mark;
    }

    // 마크다운 프리뷰는 본문을 비동기로 채워 넣을 때가 있어, DOMContentLoaded
    // 시점엔 아직 텍스트가 비어 있거나 일부만 있을 수 있다. 그 상태에서 바로
    // 복원을 시도하면 원문을 못 찾으므로, 본문이 채워질 때까지 잠시 재시도한다.
    function restore(attempt) {
      attempt = attempt || 0;
      let saved = [];
      try {
        saved = JSON.parse(localStorage.getItem(STORE_KEY) || '[]');
      } catch (err) {
        return;
      }
      if (!Array.isArray(saved) || !saved.length) return;

      const bodyReady = contentTextNodes().some(n => n.nodeValue.trim());
      if (!bodyReady && attempt < 20) {
        setTimeout(() => restore(attempt + 1), 150);
        return;
      }

      let lost = 0;
      saved.forEach(rec => {
        if (!rec || !rec.original || !rec.instruction) return;
        seq = Math.max(seq, parseInt(rec.id, 10) || 0);
        const note = { id: String(rec.id), original: rec.original,
                       display: rec.display || collapse(rec.original),
                       instruction: rec.instruction, occ: rec.occ || 1, mark: null };
        const r = rangeForOccurrence(rec.original, note.occ);
        if (r) {
          try {
            note.mark = wrap(r, note.id, rec.instruction + ' (클릭: 수정/삭제)');
          } catch (err) {
            lost++;   // 다시 감쌀 수 없는 범위
          }
        } else {
          lost++;     // 본문이 바뀌어 원문을 못 찾는 경우
        }
        notes.push(note);
      });
      render();
      if (lost) showToast('코멘트 ' + lost + '건은 본문에서 위치를 찾지 못했습니다(내용은 남아 있음).');
    }

    // ── 삭제: 코멘트 + 본문 하이라이트 원복 ──────────────────
    function removeNote(id) {
      const i = notes.findIndex(n => n.id === id);
      if (i < 0) return;
      const mark = notes[i].mark;
      if (mark && mark.parentNode) {
        const parent = mark.parentNode;
        while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
        parent.removeChild(mark);
        parent.normalize();
      }
      notes.splice(i, 1);
      render();
      save();
    }

    panel.querySelector('.rp-clear').onclick = async () => {
      if (!notes.length) return showToast('남긴 코멘트가 없습니다.');
      const ok = await openModal({
        label: '남긴 코멘트 ' + notes.length + '건을 모두 삭제할까요?',
        showInput: false, okText: '모두 삭제',
      });
      if (!ok) return;
      notes.slice().forEach(n => removeNote(n.id));
      showToast('모두 삭제했습니다.');
    };

    // ── 텍스트 선택 → 코멘트 입력 ────────────────────────────
    function clearSelection() {
      const sel = window.getSelection();
      if (sel) sel.removeAllRanges();
    }

    document.addEventListener('mouseup', async (e) => {
      if (modal.contains(e.target) || panel.contains(e.target)) return;
      if (e.target.closest && e.target.closest('mark[data-note-id]')) return;  // 기존 표시 클릭
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) return;

      // 팝업을 띄우기 전에 범위를 복제해 두고 선택은 즉시 해제한다.
      // (선택을 남겨두면 다음 클릭의 mouseup 에서 같은 선택이 다시 잡혀 팝업이 반복된다)
      const range = trimRange(sel.getRangeAt(0).cloneRange());
      clearSelection();

      // Selection.toString() 은 공백을 축약하지만 Range.toString() 은 원본 그대로다.
      // 복원할 때 DOM 텍스트와 대조해야 하므로 원본 쪽을 저장한다.
      const raw = range.toString();
      const text = collapse(raw);
      if (!text) return;

      const note = await openModal({ quote: text, label: '이 부분에 대한 코멘트:' });
      if (!note) return;

      // mark 를 넣기 전에 '몇 번째 등장'인지 세어 둔다(넣고 나면 순번이 흔들린다).
      const occ = occurrenceOf(range, raw);
      let mark;
      try {
        mark = wrap(range, String(++seq), note + ' (클릭: 수정/삭제)');
      } catch (err) {
        showToast('이 범위에는 표시를 넣을 수 없습니다. 한 문단 안에서 선택해 주세요.');
        return;
      }
      notes.push({ id: mark.dataset.noteId, original: raw, display: text,
                   instruction: note, occ, mark });
      render();
      save();
    });

    // ── 표시된 부분 클릭 → 수정 / 삭제 ─────────────────────────
    document.addEventListener('click', async (e) => {
      const mark = e.target.closest && e.target.closest('mark[data-note-id]');
      if (!mark) return;
      const n = notes.find(x => x.id === mark.dataset.noteId);
      if (!n) return;
      clearSelection();
      const next = await openModal({
        quote: n.display, label: '코멘트:', value: n.instruction, showRemove: true,
      });
      if (next === null) return;
      if (next === '__remove__' || next === '') { removeNote(n.id); return; }
      n.instruction = next;
      mark.title = n.instruction + ' (클릭: 수정/삭제)';
      render();
      save();
    });

    // ── 복사 ───────────────────────────────────────────────────
    panel.querySelector('.rp-copy').onclick = () => {
      if (!notes.length) return showToast('남긴 코멘트가 없습니다.');
      let result = '다음 텍스트에서 각 코멘트를 반영해 수정해줘:\n\n';
      notes.forEach((n, idx) => {
        result += '[수정대상 ' + (idx + 1) + ']\n- 원문: "' + n.display + '"\n- 코멘트: ' + n.instruction + '\n\n';
      });
      const done = () => showToast('코멘트 ' + notes.length + '건을 클립보드에 복사했습니다.');
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(result).then(done, () => fallbackCopy(result, done));
      } else {
        fallbackCopy(result, done);   // file:// 로 열었을 때 대비
      }
    };

    function fallbackCopy(text, done) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;top:-1000px;left:-1000px;';
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
      ta.remove();
      if (ok) { done(); return; }
      console.log(text);
      // 자동 복사가 막힌 환경(웹뷰 CSP 등) — 팝업에 띄워 직접 긁어 복사하도록 한다.
      openModal({ label: '자동 복사가 막혀 있습니다. 아래 내용을 직접 선택해 복사하세요 (Ctrl+A, Ctrl+C):', value: text, showInput: true, okText: '닫기' });
    }

    render();
    restore();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
