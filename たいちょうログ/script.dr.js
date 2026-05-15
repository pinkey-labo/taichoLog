/* ===================================
   たいちょうログ - script.js
   =================================== */

'use strict';

// ===================================
// State
// ===================================
const STORAGE_KEY = 'taichoLog_records';

let selectedMedication = null;
let selectedInjection  = null;
let selectedSymptoms   = new Set();
let selectedScore      = null;
let editingDate        = null; // 編集中の日付キー

// ===================================
// Utility
// ===================================
function loadRecords() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveRecords(records) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDateJP(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${y}年${parseInt(m)}月${parseInt(d)}日`;
}

function medLabel(val) {
  if (val === 'yes') return 'はい ✓';
  if (val === 'no')  return 'いいえ';
  if (val === 'na')  return '該当なし';
  return '未記録';
}

function scoreLabel(score) {
  if (score === null || score === undefined) return '未記録';
  if (score <= 2) return 'つらさ少なめ';
  if (score <= 4) return 'やや気になる';
  if (score <= 6) return 'かなりつらい';
  if (score <= 8) return 'とてもつらい';
  return '非常につらい';
}

function getScoreColorClass(score) {
  if (score === null) return '';
  if (score <= 3) return 'score-ok';
  if (score <= 6) return 'score-mid';
  return 'score-high';
}

// ===================================
// Tab Navigation
// ===================================
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => {
      b.classList.remove('active');
      b.setAttribute('aria-selected', 'false');
    });
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));

    btn.classList.add('active');
    btn.setAttribute('aria-selected', 'true');
    const target = btn.dataset.tab;
    document.getElementById(`panel-${target}`).classList.add('active');

    if (target === 'list')  renderRecordList();
    if (target === 'share') initSharePanel();
  });
});

// ===================================
// Form: Date
// ===================================
const recordDateInput = document.getElementById('record-date');
recordDateInput.value = todayStr();

// ===================================
// Form: Choice Buttons (medication / injection)
// ===================================
document.querySelectorAll('.choice-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const group = btn.dataset.group;
    const val   = btn.dataset.value;

    // Deselect same group
    document.querySelectorAll(`.choice-btn[data-group="${group}"]`).forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');

    if (group === 'medication') selectedMedication = val;
    if (group === 'injection')  selectedInjection  = val;
  });
});

// ===================================
// Form: Symptom Buttons
// ===================================
document.querySelectorAll('.symptom-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const sym = btn.dataset.symptom;
    if (selectedSymptoms.has(sym)) {
      selectedSymptoms.delete(sym);
      btn.classList.remove('selected');
    } else {
      selectedSymptoms.add(sym);
      btn.classList.add('selected');
    }
  });
});

// ===================================
// Form: Score Buttons
// ===================================
const scoreDisplay = document.getElementById('score-display');
const scoreLabelEl = document.getElementById('score-label');

document.querySelectorAll('.score-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const sc = parseInt(btn.dataset.score, 10);
    selectedScore = sc;

    document.querySelectorAll('.score-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');

    scoreDisplay.textContent = sc;
    scoreLabelEl.textContent = scoreLabel(sc);
  });
});

// ===================================
// Save Record
// ===================================
function saveRecord() {
  const date = recordDateInput.value;
  if (!date) {
    alert('日付を選択してください。');
    return;
  }

  const records = loadRecords();

  if (records[date]) {
    showOverwriteModal(date, () => doSave(date, records));
    return;
  }

  doSave(date, records);
}

function doSave(date, records) {
  const memo = document.getElementById('memo-input').value.trim();

  records[date] = {
    date,
    medication: selectedMedication,
    injection:  selectedInjection,
    symptoms:   Array.from(selectedSymptoms),
    score:      selectedScore,
    memo,
    savedAt:    new Date().toISOString(),
  };

  saveRecords(records);
  showSaveSuccess();
  renderWeeklySummary();
}

function showSaveSuccess() {
  const el = document.getElementById('save-success');
  el.hidden = false;
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  setTimeout(() => { el.hidden = true; }, 3000);
}

// ===================================
// Weekly Summary
// ===================================
function renderWeeklySummary() {
  const container = document.getElementById('summary-content');
  const records   = loadRecords();
  const keys      = Object.keys(records).sort().reverse().slice(0, 7);

  if (keys.length === 0) {
    container.innerHTML = '<p class="summary-empty">まだ記録がありません。<br>下のフォームから記録を始めましょう。</p>';
    return;
  }

  // 服薬率
  const medYes = keys.filter(k => records[k].medication === 'yes').length;
  const medTotal = keys.filter(k => records[k].medication !== 'na').length;
  const medRate = medTotal > 0 ? `${medYes}/${medTotal}日` : '－';

  // 平均スコア
  const scored = keys.map(k => records[k].score).filter(s => s !== null && s !== undefined);
  const avgScore = scored.length > 0 ? (scored.reduce((a, b) => a + b, 0) / scored.length).toFixed(1) : '－';

  // 多かった副作用
  const symCount = {};
  keys.forEach(k => {
    (records[k].symptoms || []).forEach(s => { symCount[s] = (symCount[s] || 0) + 1; });
  });
  const topSyms = Object.entries(symCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([s]) => s);

  container.innerHTML = `
    <div class="summary-item">
      <div class="summary-item-label">記録日数</div>
      <div class="summary-item-value">${keys.length}日</div>
      <div class="summary-item-sub">直近7日間</div>
    </div>
    <div class="summary-item">
      <div class="summary-item-label">服薬できた日</div>
      <div class="summary-item-value">${medRate}</div>
      <div class="summary-item-sub">（該当なし除く）</div>
    </div>
    <div class="summary-item">
      <div class="summary-item-label">平均つらさ</div>
      <div class="summary-item-value">${avgScore !== '－' ? avgScore + '/10' : '－'}</div>
      <div class="summary-item-sub">${scored.length}日分</div>
    </div>
    <div class="summary-item">
      <div class="summary-item-label">多かった副作用</div>
      <div class="summary-item-value" style="font-size:0.85rem">${topSyms.length > 0 ? topSyms.join('、') : 'なし'}</div>
    </div>
  `;
}

// ===================================
// Record List
// ===================================
function renderRecordList() {
  const container = document.getElementById('record-list-container');
  const records   = loadRecords();
  const keys      = Object.keys(records).sort().reverse();

  if (keys.length === 0) {
    container.innerHTML = '<p class="empty-msg">記録がありません</p>';
    return;
  }

  container.innerHTML = keys.map(k => renderRecordItem(records[k])).join('');
}

function renderRecordItem(rec) {
  const scoreVal = rec.score !== null && rec.score !== undefined ? rec.score : null;
  const scoreBadge = scoreVal !== null
    ? `<span class="record-score-badge">つらさ ${scoreVal}/10</span>`
    : '';

  const medTagClass = rec.medication === 'yes' ? 'meta-tag med-yes'
                    : rec.medication === 'no'  ? 'meta-tag med-no'
                    : 'meta-tag';

  const symTags = (rec.symptoms || []).map(s => `<span class="symptom-tag">${s}</span>`).join('');

  const memoHtml = rec.memo
    ? `<div class="record-memo-preview">📝 ${escapeHtml(rec.memo.slice(0, 80))}${rec.memo.length > 80 ? '…' : ''}</div>`
    : '';

  return `
    <div class="record-item" id="record-${rec.date}">
      <div class="record-item-header">
        <div class="record-date-big">${formatDateJP(rec.date)}</div>
        ${scoreBadge}
      </div>
      <div class="record-meta">
        <span class="${medTagClass}">💊 ${medLabel(rec.medication)}</span>
        ${rec.injection !== null ? `<span class="meta-tag">💉 注射：${medLabel(rec.injection)}</span>` : ''}
      </div>
      ${symTags ? `<div class="record-symptoms">${symTags}</div>` : ''}
      ${memoHtml}
      <div class="record-actions">
        <button class="edit-btn" onclick="openEditModal('${rec.date}')">✏️ 編集</button>
        <button class="delete-btn" onclick="confirmDeleteRecord('${rec.date}')">🗑 削除</button>
      </div>
    </div>
  `;
}

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ===================================
// Delete Record
// ===================================
function confirmDeleteRecord(date) {
  showModal(
    `${formatDateJP(date)} の記録を削除しますか？`,
    'この操作は元に戻せません。',
    () => {
      const records = loadRecords();
      delete records[date];
      saveRecords(records);
      renderRecordList();
      renderWeeklySummary();
    }
  );
}

function confirmDeleteAll() {
  const records = loadRecords();
  const count   = Object.keys(records).length;
  if (count === 0) {
    alert('削除する記録がありません。');
    return;
  }
  showModal(
    'すべての記録を削除しますか？',
    `${count}件の記録がすべて削除されます。この操作は元に戻せません。`,
    () => {
      localStorage.removeItem(STORAGE_KEY);
      renderRecordList();
      renderWeeklySummary();
    }
  );
}

// ===================================
// Modal (Delete Confirm)
// ===================================
function showModal(title, body, onConfirm) {
  const overlay = document.getElementById('modal-overlay');
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').textContent  = body;
  overlay.hidden = false;

  const cancel  = document.getElementById('modal-cancel');
  const confirm = document.getElementById('modal-confirm');

  function close() {
    overlay.hidden = true;
    cancel.removeEventListener('click', onCancel);
    confirm.removeEventListener('click', onConfirmClick);
    overlay.removeEventListener('click', onOverlayClick);
  }

  function onCancel()      { close(); }
  function onConfirmClick()  { close(); onConfirm(); }
  function onOverlayClick(e) { if (e.target === overlay) close(); }

  cancel.addEventListener('click', onCancel);
  confirm.addEventListener('click', onConfirmClick);
  overlay.addEventListener('click', onOverlayClick);
}

// ===================================
// Modal (Overwrite Confirm)
// ===================================
function showOverwriteModal(date, onConfirm) {
  const overlay = document.getElementById('overwrite-overlay');
  document.getElementById('overwrite-body').textContent = `${formatDateJP(date)} の記録がすでにあります。上書きしますか？`;
  overlay.hidden = false;

  const cancel  = document.getElementById('overwrite-cancel');
  const confirm = document.getElementById('overwrite-confirm');

  function close() {
    overlay.hidden = true;
    cancel.removeEventListener('click', onCancel);
    confirm.removeEventListener('click', onConfirmClick);
    overlay.removeEventListener('click', onOverlayClick);
  }

  function onCancel()       { close(); }
  function onConfirmClick() { close(); onConfirm(); }
  function onOverlayClick(e){ if (e.target === overlay) close(); }

  cancel.addEventListener('click', onCancel);
  confirm.addEventListener('click', onConfirmClick);
  overlay.addEventListener('click', onOverlayClick);
}

// ===================================
// Edit Modal
// ===================================
function openEditModal(date) {
  const records = loadRecords();
  const rec     = records[date];
  if (!rec) return;

  editingDate = date;
  const wrap  = document.getElementById('edit-form-wrap');

  const symptomList = [
    'ほてり','眠気','吐き気','食欲不振','倦怠感','関節痛',
    '手指のこわばり','しびれ','むくみ','口内炎','下痢','便秘',
    '皮膚症状','気分の落ち込み','その他'
  ];

  const symptomIcons = {
    'ほてり':'🌡','眠気':'😪','吐き気':'🤢','食欲不振':'🍽','倦怠感':'😓',
    '関節痛':'🦴','手指のこわばり':'🤲','しびれ':'⚡','むくみ':'💧','口内炎':'👄',
    '下痢':'💨','便秘':'⚠️','皮膚症状':'🧴','気分の落ち込み':'🌧','その他':'＋'
  };

  const selectedSymsEdit = new Set(rec.symptoms || []);

  wrap.innerHTML = `
    <!-- 日付（表示のみ） -->
    <div class="form-section">
      <p class="form-label">📅 日付</p>
      <p style="font-size:1rem;font-weight:700;color:var(--sage-dark)">${formatDateJP(date)}</p>
    </div>

    <!-- 服薬 -->
    <div class="form-section">
      <p class="form-label">💊 服薬しましたか？</p>
      <div class="btn-group three-col" role="group">
        <button type="button" class="choice-btn edit-choice ${rec.medication === 'yes' ? 'selected' : ''}" data-edit-group="medication" data-value="yes">はい</button>
        <button type="button" class="choice-btn edit-choice ${rec.medication === 'no'  ? 'selected' : ''}" data-edit-group="medication" data-value="no">いいえ</button>
        <button type="button" class="choice-btn edit-choice ${rec.medication === 'na'  ? 'selected' : ''}" data-edit-group="medication" data-value="na">該当なし</button>
      </div>
    </div>

    <!-- 注射 -->
    <div class="form-section">
      <p class="form-label">💉 注射しましたか？</p>
      <div class="btn-group three-col" role="group">
        <button type="button" class="choice-btn edit-choice ${rec.injection === 'yes' ? 'selected' : ''}" data-edit-group="injection" data-value="yes">はい</button>
        <button type="button" class="choice-btn edit-choice ${rec.injection === 'no'  ? 'selected' : ''}" data-edit-group="injection" data-value="no">いいえ</button>
        <button type="button" class="choice-btn edit-choice ${rec.injection === 'na'  ? 'selected' : ''}" data-edit-group="injection" data-value="na">該当なし</button>
      </div>
    </div>

    <!-- 副作用 -->
    <div class="form-section">
      <p class="form-label">🌡️ 副作用</p>
      <div class="symptom-grid" role="group">
        ${symptomList.map(s => `
          <button type="button" class="symptom-btn edit-symptom ${selectedSymsEdit.has(s) ? 'selected' : ''}" data-symptom="${s}">
            ${symptomIcons[s] || ''} ${s}
          </button>
        `).join('')}
      </div>
    </div>

    <!-- スコア -->
    <div class="form-section">
      <p class="form-label">😌 つらさスコア</p>
      <div class="score-display">
        <span class="score-value" id="edit-score-display">${rec.score !== null && rec.score !== undefined ? rec.score : '－'}</span>
        <span class="score-label" id="edit-score-label">${rec.score !== null && rec.score !== undefined ? scoreLabel(rec.score) : '未選択'}</span>
      </div>
      <div class="score-grid" role="group">
        ${[0,1,2,3,4,5,6,7,8,9,10].map(n => `
          <button type="button" class="score-btn edit-score ${rec.score === n ? 'selected' : ''}" data-score="${n}">${n}</button>
        `).join('')}
      </div>
    </div>

    <!-- メモ -->
    <div class="form-section">
      <label class="form-label" for="edit-memo">📝 メモ</label>
      <textarea id="edit-memo" class="memo-textarea" rows="4">${escapeHtml(rec.memo || '')}</textarea>
    </div>
  `;

  // Bind choice buttons in edit modal
  wrap.querySelectorAll('.edit-choice').forEach(btn => {
    btn.addEventListener('click', () => {
      const group = btn.dataset.editGroup;
      wrap.querySelectorAll(`.edit-choice[data-edit-group="${group}"]`).forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    });
  });

  // Bind symptom buttons in edit modal
  wrap.querySelectorAll('.edit-symptom').forEach(btn => {
    btn.addEventListener('click', () => {
      const sym = btn.dataset.symptom;
      if (selectedSymsEdit.has(sym)) {
        selectedSymsEdit.delete(sym);
        btn.classList.remove('selected');
      } else {
        selectedSymsEdit.add(sym);
        btn.classList.add('selected');
      }
    });
  });

  // Bind score buttons in edit modal
  wrap.querySelectorAll('.edit-score').forEach(btn => {
    btn.addEventListener('click', () => {
      const sc = parseInt(btn.dataset.score, 10);
      wrap.querySelectorAll('.edit-score').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      document.getElementById('edit-score-display').textContent = sc;
      document.getElementById('edit-score-label').textContent   = scoreLabel(sc);
    });
  });

  // Show modal
  const overlay = document.getElementById('edit-overlay');
  overlay.hidden = false;
  overlay.scrollTop = 0;

  // Save handler
  const saveBtn   = document.getElementById('edit-save');
  const cancelBtn = document.getElementById('edit-cancel');
  const closeBtn  = document.getElementById('edit-close');

  function closeEdit() {
    overlay.hidden = true;
    editingDate = null;
    saveBtn.removeEventListener('click', onSave);
    cancelBtn.removeEventListener('click', closeEdit);
    closeBtn.removeEventListener('click', closeEdit);
    overlay.removeEventListener('click', onOverlayClick);
  }

  function onSave() {
    const records2 = loadRecords();

    const medSelected  = wrap.querySelector('.edit-choice[data-edit-group="medication"].selected');
    const injSelected  = wrap.querySelector('.edit-choice[data-edit-group="injection"].selected');
    const scoreSelected = wrap.querySelector('.edit-score.selected');

    records2[editingDate] = {
      date:       editingDate,
      medication: medSelected  ? medSelected.dataset.value  : null,
      injection:  injSelected  ? injSelected.dataset.value  : null,
      symptoms:   Array.from(selectedSymsEdit),
      score:      scoreSelected ? parseInt(scoreSelected.dataset.score, 10) : null,
      memo:       document.getElementById('edit-memo').value.trim(),
      savedAt:    new Date().toISOString(),
    };

    saveRecords(records2);
    closeEdit();
    renderRecordList();
    renderWeeklySummary();
  }

  function onOverlayClick(e) { if (e.target === overlay) closeEdit(); }

  saveBtn.addEventListener('click', onSave);
  cancelBtn.addEventListener('click', closeEdit);
  closeBtn.addEventListener('click', closeEdit);
  overlay.addEventListener('click', onOverlayClick);
}

// ===================================
// Share Text Generation
// ===================================
function initSharePanel() {
  const monthInput = document.getElementById('share-month');
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  if (!monthInput.value) {
    monthInput.value = `${y}-${m}`;
  }
}

function generateShareText() {
  const monthVal = document.getElementById('share-month').value;
  if (!monthVal) {
    alert('月を選択してください。');
    return;
  }

  const [y, m] = monthVal.split('-');
  const records = loadRecords();

  // Filter records for this month
  const keys = Object.keys(records)
    .filter(k => k.startsWith(`${y}-${m}`))
    .sort();

  if (keys.length === 0) {
    alert(`${y}年${parseInt(m)}月の記録が見つかりません。`);
    return;
  }

  const recs = keys.map(k => records[k]);

  // Days in month
  const daysInMonth = new Date(parseInt(y), parseInt(m), 0).getDate();

  // 服薬
  const medYesDays = recs.filter(r => r.medication === 'yes').length;

  // 注射
  const injYesDays = recs.filter(r => r.injection === 'yes').length;

  // 副作用集計
  const symCount = {};
  recs.forEach(r => {
    (r.symptoms || []).forEach(s => { symCount[s] = (symCount[s] || 0) + 1; });
  });
  const topSyms = Object.entries(symCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([s, c]) => `${s}（${c}日）`);

  // 平均スコア
  const scored = recs.map(r => r.score).filter(s => s !== null && s !== undefined);
  const avgScore = scored.length > 0
    ? (scored.reduce((a, b) => a + b, 0) / scored.length).toFixed(1)
    : null;

  // メモ
  const memos = recs.filter(r => r.memo).map(r => `・${r.memo}`);

  // Build text
  let text = '';
  text += `【${y}年${parseInt(m)}月の体調ログまとめ】\n`;
  text += `記録日数：${keys.length}日 / ${daysInMonth}日\n`;
  text += `服薬できた日：${medYesDays}日\n`;
  if (injYesDays > 0) {
    text += `注射した日：${injYesDays}日\n`;
  }
  if (topSyms.length > 0) {
    text += `多かった副作用：${topSyms.join('、')}\n`;
  } else {
    text += `副作用の記録：なし\n`;
  }
  if (avgScore !== null) {
    text += `平均つらさ：${avgScore}/10（${scored.length}日分）\n`;
  }

  if (memos.length > 0) {
    text += `\n【気になったメモ】\n`;
    memos.slice(0, 10).forEach(memo => { text += `${memo}\n`; });
    if (memos.length > 10) {
      text += `（他${memos.length - 10}件）\n`;
    }
  }

  text += `\n【注意文】\n`;
  text += `この記録は診察時の相談を補助するものであり、診断や治療方針を決めるものではありません。気になる症状がある場合は医療機関へ相談してください。`;

  const outputEl = document.getElementById('share-output');
  const wrapEl   = document.getElementById('share-output-wrap');
  outputEl.textContent = text;
  wrapEl.hidden = false;
  wrapEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  // Reset copy button
  document.getElementById('copy-icon').textContent  = '📋';
  document.getElementById('copy-label').textContent = 'テキストをコピーする';
  document.querySelector('.copy-btn').classList.remove('copied');
}

function copyShareText() {
  const text = document.getElementById('share-output').textContent;
  if (!text) return;

  const copyBtn  = document.querySelector('.copy-btn');
  const copyIcon = document.getElementById('copy-icon');
  const copyLbl  = document.getElementById('copy-label');

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      copyIcon.textContent = '✅';
      copyLbl.textContent  = 'コピーしました！';
      copyBtn.classList.add('copied');
      setTimeout(() => {
        copyIcon.textContent = '📋';
        copyLbl.textContent  = 'テキストをコピーする';
        copyBtn.classList.remove('copied');
      }, 2500);
    }).catch(() => fallbackCopy(text, copyBtn, copyIcon, copyLbl));
  } else {
    fallbackCopy(text, copyBtn, copyIcon, copyLbl);
  }
}

function fallbackCopy(text, copyBtn, copyIcon, copyLbl) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity  = '0';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  try {
    document.execCommand('copy');
    copyIcon.textContent = '✅';
    copyLbl.textContent  = 'コピーしました！';
    copyBtn.classList.add('copied');
    setTimeout(() => {
      copyIcon.textContent = '📋';
      copyLbl.textContent  = 'テキストをコピーする';
      copyBtn.classList.remove('copied');
    }, 2500);
  } catch {
    alert('コピーに失敗しました。テキストを手動でコピーしてください。');
  }
  document.body.removeChild(ta);
}

// ===================================
// Calendar View
// ===================================
let calYear  = new Date().getFullYear();
let calMonth = new Date().getMonth() + 1;

const SCORE_COLORS = {
  0:'#5a9e7c', 1:'#6aaa7a', 2:'#88b86e', 3:'#a8c464', 4:'#c8cc58',
  5:'#e0c040', 6:'#e8a040', 7:'#e88040', 8:'#e06040', 9:'#d84030', 10:'#c02828'
};

function initCalendar() {
  renderCalendar();
  document.getElementById('cal-prev').addEventListener('click', () => {
    calMonth--;
    if (calMonth < 1) { calMonth = 12; calYear--; }
    renderCalendar();
  });
  document.getElementById('cal-next').addEventListener('click', () => {
    calMonth++;
    if (calMonth > 12) { calMonth = 1; calYear++; }
    renderCalendar();
  });
  document.getElementById('cal-detail-close').addEventListener('click', closeCalDetail);
  document.getElementById('cal-detail-overlay').addEventListener('click', (e) => {
    if (e.target === document.getElementById('cal-detail-overlay')) closeCalDetail();
  });
}

function renderCalendar() {
  const records     = loadRecords();
  const daysInMonth = new Date(calYear, calMonth, 0).getDate();
  const firstDow    = new Date(calYear, calMonth - 1, 1).getDay();
  const todayKey    = todayStr();

  document.getElementById('cal-month-title').textContent = `${calYear}年 ${calMonth}月`;

  const grid = document.getElementById('cal-grid');
  grid.innerHTML = '';

  for (let i = 0; i < firstDow; i++) {
    const blank = document.createElement('div');
    blank.className = 'cal-day empty';
    grid.appendChild(blank);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const mm  = String(calMonth).padStart(2, '0');
    const dd  = String(d).padStart(2, '0');
    const key = `${calYear}-${mm}-${dd}`;
    const rec = records[key];
    const dow = new Date(calYear, calMonth - 1, d).getDay();

    const cell = document.createElement('div');
    cell.className = 'cal-day';

    if (key === todayKey) cell.classList.add('today-cell');

    if (rec) {
      cell.classList.add('has-record');
      if (rec.score !== null && rec.score !== undefined) {
        cell.classList.add(`score-${rec.score}`);
      } else {
        cell.classList.add('score-none');
      }
    } else {
      cell.classList.add('no-record');
    }

    const numEl = document.createElement('div');
    numEl.className = 'cal-day-num';
    if (dow === 0) numEl.classList.add('sun-num');
    if (dow === 6) numEl.classList.add('sat-num');
    numEl.textContent = d;
    cell.appendChild(numEl);

    if (rec) {
      const iconsEl = document.createElement('div');
      iconsEl.className = 'cal-day-icons';
      if (rec.medication === 'yes') {
        const mi = document.createElement('span');
        mi.textContent = '💊';
        iconsEl.appendChild(mi);
      }
      if (rec.injection === 'yes') {
        const ii = document.createElement('span');
        ii.textContent = '💉';
        iconsEl.appendChild(ii);
      }
      if (rec.symptoms && rec.symptoms.length > 0) {
        const sc = document.createElement('span');
        sc.className = 'cal-sym-count';
        sc.textContent = `症${rec.symptoms.length}`;
        iconsEl.appendChild(sc);
      }
      cell.appendChild(iconsEl);
      cell.addEventListener('click', () => openCalDetail(key, rec));
    }

    grid.appendChild(cell);
  }

  renderCalSummary(records, calYear, calMonth, daysInMonth);
}

function renderCalSummary(records, y, m, daysInMonth) {
  const mm   = String(m).padStart(2, '0');
  const keys = Object.keys(records).filter(k => k.startsWith(`${y}-${mm}`)).sort();
  const container = document.getElementById('cal-summary-content');

  if (keys.length === 0) {
    container.innerHTML = '<p class="summary-empty" style="grid-column:1/-1">この月の記録はありません</p>';
    return;
  }

  const recs     = keys.map(k => records[k]);
  const medYes   = recs.filter(r => r.medication === 'yes').length;
  const injYes   = recs.filter(r => r.injection  === 'yes').length;
  const scored   = recs.map(r => r.score).filter(s => s !== null && s !== undefined);
  const avgScore = scored.length > 0 ? (scored.reduce((a,b)=>a+b,0)/scored.length).toFixed(1) : null;
  const maxScore = scored.length > 0 ? Math.max(...scored) : null;

  const symCount = {};
  recs.forEach(r => (r.symptoms||[]).forEach(s => { symCount[s] = (symCount[s]||0)+1; }));
  const topSyms = Object.entries(symCount).sort((a,b)=>b[1]-a[1]).slice(0,5);

  container.innerHTML = `
    <div class="cal-sum-item">
      <div class="cal-sum-label">記録日数</div>
      <div class="cal-sum-value">${keys.length}日</div>
      <div class="cal-sum-sub">/ ${daysInMonth}日中</div>
    </div>
    <div class="cal-sum-item">
      <div class="cal-sum-label">服薬できた日</div>
      <div class="cal-sum-value">${medYes}日</div>
      <div class="cal-sum-sub">${injYes > 0 ? `注射：${injYes}日` : '&nbsp;'}</div>
    </div>
    <div class="cal-sum-item">
      <div class="cal-sum-label">平均つらさ</div>
      <div class="cal-sum-value">${avgScore !== null ? avgScore + '/10' : '－'}</div>
      <div class="cal-sum-sub">${scored.length}日分</div>
    </div>
    <div class="cal-sum-item">
      <div class="cal-sum-label">最大つらさ</div>
      <div class="cal-sum-value">${maxScore !== null ? maxScore + '/10' : '－'}</div>
      <div class="cal-sum-sub">&nbsp;</div>
    </div>
    <div class="cal-sum-item cal-sym-list">
      <div class="cal-sum-label">多かった副作用</div>
      <div class="cal-sym-tags">
        ${topSyms.length > 0
          ? topSyms.map(([s,c]) => `<span class="cal-sym-tag">${s} <strong>${c}日</strong></span>`).join('')
          : '<span style="font-size:0.85rem;color:var(--text-hint)">記録なし</span>'}
      </div>
    </div>
  `;
}

function openCalDetail(dateKey, rec) {
  document.getElementById('cal-detail-date').textContent = formatDateJP(dateKey);

  const scoreVal   = rec.score !== null && rec.score !== undefined ? rec.score : null;
  const scoreColor = scoreVal !== null ? SCORE_COLORS[scoreVal] : '#ccc';

  const scoreBadge = scoreVal !== null
    ? `<span class="detail-score-badge" style="background:${scoreColor}">${scoreVal}</span>
       <span style="font-size:0.85rem;color:var(--text-secondary);margin-left:8px">${scoreLabel(scoreVal)}</span>`
    : '<span style="color:var(--text-hint)">未記録</span>';

  const symptomsHtml = (rec.symptoms && rec.symptoms.length > 0)
    ? `<div style="display:flex;flex-wrap:wrap;gap:5px">${rec.symptoms.map(s => `<span class="symptom-tag">${s}</span>`).join('')}</div>`
    : '<span style="color:var(--text-hint)">なし</span>';

  const memoHtml = rec.memo
    ? `<span style="white-space:pre-wrap">${escapeHtml(rec.memo)}</span>`
    : '<span style="color:var(--text-hint)">なし</span>';

  document.getElementById('cal-detail-content').innerHTML = `
    <div class="detail-row">
      <div class="detail-row-label">💊 服薬</div>
      <div class="detail-row-value">${medLabel(rec.medication)}</div>
    </div>
    <div class="detail-row">
      <div class="detail-row-label">💉 注射</div>
      <div class="detail-row-value">${medLabel(rec.injection)}</div>
    </div>
    <div class="detail-row">
      <div class="detail-row-label">😌 つらさ</div>
      <div class="detail-row-value" style="display:flex;align-items:center">${scoreBadge}</div>
    </div>
    <div class="detail-row">
      <div class="detail-row-label">🌡️ 副作用</div>
      <div class="detail-row-value">${symptomsHtml}</div>
    </div>
    <div class="detail-row">
      <div class="detail-row-label">📝 メモ</div>
      <div class="detail-row-value">${memoHtml}</div>
    </div>
  `;

  document.getElementById('cal-detail-overlay').hidden = false;
}

function closeCalDetail() {
  document.getElementById('cal-detail-overlay').hidden = true;
}

// ===================================
// Tab: カレンダーも再描画
// ===================================

// ===================================
// Init
// ===================================
document.addEventListener('DOMContentLoaded', () => {
  renderWeeklySummary();
  initCalendar();

  // カレンダータブ切り替え時に再描画
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.tab === 'calendar') renderCalendar();
    });
  });
});
