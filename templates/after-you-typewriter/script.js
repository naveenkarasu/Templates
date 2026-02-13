/*
 * After You — Communal Digital Typewriter
 *
 * Typewriter mechanics:
 * - Carriage starts offset to the right
 * - Each keystroke moves carriage + paper left
 * - Drag carriage right to return (new line + paper advance)
 * - Paper is continuous and scrollable
 *
 * TODO: For communal/multi-user support, integrate a real-time backend
 * (e.g. WebSocket, Firebase Realtime DB, or Supabase) to sync:
 * - state.lines (shared paper content)
 * - state.snapshots (shared snapshot history)
 */

const CHAR_WIDTH = 9.62;
const MAX_CHARS = 52;
const LINE_HEIGHT = 22;
const INITIAL_OFFSET = 280;

const state = {
  lines: [[]],
  currentLine: 0,
  currentChar: 0,
  inkColor: '#1a1a1a',
  isRed: false,
  snapshots: [],
  carriageX: INITIAL_OFFSET,
  isDragging: false,
  dragStartX: 0,
  dragStartCarriageX: 0,
  paperScrollY: 0
};

// DOM references
const paperCarriage = document.getElementById('paperCarriage');
const carriageLayer = document.getElementById('carriageLayer');
const textContent = document.getElementById('textContent');
const paperClip = document.querySelector('.paper-clip-region');
const inkDot = document.querySelector('.ink-dot');
const btnInk = document.querySelector('.btn-ink');
const btnSnapshot = document.querySelector('.btn-snapshot');
const snapshotsBtn = document.querySelector('.snapshots-btn');
const modalOverlay = document.getElementById('modalOverlay');
const snapshotGrid = document.getElementById('snapshotGrid');
const keys = document.querySelectorAll('.key');

// ─── Rendering ───

function renderPaper() {
  textContent.innerHTML = state.lines.map((line, lineIdx) => {
    let html = line.map(ch =>
      `<span style="color:${ch.color}">${escapeHtml(ch.char)}</span>`
    ).join('');

    if (lineIdx === state.currentLine) {
      html += '<span class="cursor"></span>';
    }

    return `<div class="line">${html || (lineIdx === state.currentLine ? '<span class="cursor"></span>' : '&nbsp;')}</div>`;
  }).join('');

  scrollToCurrentLine();
}

function escapeHtml(ch) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return map[ch] || ch;
}

function updateCarriagePosition(animate) {
  const val = `translateX(${state.carriageX}px)`;
  if (animate) {
    paperCarriage.style.transition = 'transform 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
    carriageLayer.style.transition = 'transform 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
  } else {
    paperCarriage.style.transition = 'transform 0.05s linear';
    carriageLayer.style.transition = 'transform 0.05s linear';
  }
  paperCarriage.style.transform = val;
  carriageLayer.style.transform = val;
}

function scrollToCurrentLine() {
  const targetY = state.currentLine * LINE_HEIGHT;
  const clipHeight = paperClip.offsetHeight;
  const visibleLines = Math.floor(clipHeight / LINE_HEIGHT);

  if (state.currentLine >= visibleLines - 2) {
    const scrollY = (state.currentLine - visibleLines + 3) * LINE_HEIGHT;
    paperCarriage.querySelector('.paper').style.transform = `translateY(${-scrollY}px)`;
  }
}

// ─── Typing ───

function typeCharacter(char) {
  if (state.currentChar >= MAX_CHARS) return;

  state.lines[state.currentLine].push({
    char: char,
    color: state.inkColor
  });
  state.currentChar++;
  state.carriageX -= CHAR_WIDTH;

  updateCarriagePosition(false);
  renderPaper();
}

function carriageReturn() {
  state.lines.push([]);
  state.currentLine++;
  state.currentChar = 0;
  state.carriageX = INITIAL_OFFSET;

  updateCarriagePosition(true);

  setTimeout(() => {
    renderPaper();
  }, 50);
}

// ─── Keyboard Input ───

document.addEventListener('keydown', (e) => {
  if (modalOverlay.classList.contains('active')) {
    if (e.key === 'Escape') closeModal();
    return;
  }

  // Visual key press feedback
  highlightKey(e.key);

  if (e.key === 'Enter') {
    e.preventDefault();
    carriageReturn();
    return;
  }

  if (e.key === 'Backspace') {
    e.preventDefault();
    if (state.currentChar > 0) {
      state.lines[state.currentLine].pop();
      state.currentChar--;
      state.carriageX += CHAR_WIDTH;
      updateCarriagePosition(false);
      renderPaper();
    }
    return;
  }

  if (e.key === 'Tab') {
    e.preventDefault();
    for (let i = 0; i < 4 && state.currentChar < MAX_CHARS; i++) {
      typeCharacter(' ');
    }
    return;
  }

  // Ignore non-printable keys
  if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return;

  e.preventDefault();
  typeCharacter(e.key);
});

document.addEventListener('keyup', (e) => {
  unhighlightKey(e.key);
});

// ─── Key Visual Feedback ───

function highlightKey(key) {
  const normalizedKey = key.toUpperCase();
  for (const el of keys) {
    if (el.dataset.key === normalizedKey || el.dataset.key === key) {
      el.classList.add('pressed');
      break;
    }
  }
}

function unhighlightKey(key) {
  const normalizedKey = key.toUpperCase();
  for (const el of keys) {
    if (el.dataset.key === normalizedKey || el.dataset.key === key) {
      el.classList.remove('pressed');
      break;
    }
  }
}

// ─── Carriage Drag ───

carriageLayer.addEventListener('mousedown', startDrag);
carriageLayer.addEventListener('touchstart', startDragTouch, { passive: false });

function startDrag(e) {
  state.isDragging = true;
  state.dragStartX = e.clientX;
  state.dragStartCarriageX = state.carriageX;
  carriageLayer.style.cursor = 'grabbing';

  document.addEventListener('mousemove', onDrag);
  document.addEventListener('mouseup', endDrag);
}

function startDragTouch(e) {
  e.preventDefault();
  state.isDragging = true;
  state.dragStartX = e.touches[0].clientX;
  state.dragStartCarriageX = state.carriageX;

  document.addEventListener('touchmove', onDragTouch, { passive: false });
  document.addEventListener('touchend', endDragTouch);
}

function onDrag(e) {
  if (!state.isDragging) return;
  const dx = e.clientX - state.dragStartX;
  const newX = Math.min(INITIAL_OFFSET, Math.max(state.dragStartCarriageX + dx, state.dragStartCarriageX));
  state.carriageX = newX;
  updateCarriagePosition(false);
}

function onDragTouch(e) {
  if (!state.isDragging) return;
  e.preventDefault();
  const dx = e.touches[0].clientX - state.dragStartX;
  const newX = Math.min(INITIAL_OFFSET, Math.max(state.dragStartCarriageX + dx, state.dragStartCarriageX));
  state.carriageX = newX;
  updateCarriagePosition(false);
}

function endDrag() {
  if (!state.isDragging) return;
  state.isDragging = false;
  carriageLayer.style.cursor = 'grab';
  document.removeEventListener('mousemove', onDrag);
  document.removeEventListener('mouseup', endDrag);

  if (state.carriageX > state.dragStartCarriageX + 60) {
    carriageReturn();
  }
}

function endDragTouch() {
  if (!state.isDragging) return;
  state.isDragging = false;
  document.removeEventListener('touchmove', onDragTouch);
  document.removeEventListener('touchend', endDragTouch);

  if (state.carriageX > state.dragStartCarriageX + 60) {
    carriageReturn();
  }
}

// ─── Paper Scroll (read previous text) ───

paperClip.addEventListener('wheel', (e) => {
  e.preventDefault();
  const paper = paperCarriage.querySelector('.paper');
  const currentY = parseFloat(paper.style.transform?.match(/translateY\((.+?)px\)/)?.[1] || 0);
  const newY = Math.min(0, currentY - e.deltaY * 0.5);
  paper.style.transform = `translateY(${newY}px)`;
}, { passive: false });

// ─── Ink Ribbon ───

btnInk.addEventListener('click', () => {
  state.isRed = !state.isRed;
  state.inkColor = state.isRed ? '#c41e3a' : '#1a1a1a';
  inkDot.classList.toggle('red', state.isRed);
});

// ─── Snapshots ───

btnSnapshot.addEventListener('click', () => {
  const totalLines = state.lines.length;
  const startLine = Math.max(0, totalLines - 15);
  const capturedLines = state.lines.slice(startLine, totalLines);

  const textSnapshot = capturedLines.map(line =>
    line.map(ch => ch.char).join('')
  ).join('\n');

  const colorSnapshot = capturedLines.map(line =>
    line.map(ch => ({ char: ch.char, color: ch.color }))
  );

  state.snapshots.unshift({
    text: textSnapshot,
    lines: colorSnapshot,
    date: new Date()
  });

  // Brief visual feedback
  btnSnapshot.style.background = 'rgba(0,0,0,0.06)';
  setTimeout(() => { btnSnapshot.style.background = ''; }, 300);
});

snapshotsBtn.addEventListener('click', openModal);

function openModal() {
  renderSnapshots();
  modalOverlay.classList.add('active');
}

function closeModal() {
  modalOverlay.classList.remove('active');
}

modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) closeModal();
});

function renderSnapshots() {
  if (state.snapshots.length === 0) {
    snapshotGrid.innerHTML = '<p class="no-snapshots">No snapshots yet. Type something and take a snapshot.</p>';
    return;
  }

  snapshotGrid.innerHTML = state.snapshots.map(snap => {
    const dateStr = snap.date.toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric'
    });
    const timeStr = snap.date.toLocaleTimeString('en-US', {
      hour: 'numeric', minute: '2-digit'
    });

    const textHtml = snap.lines.map(line =>
      line.map(ch => `<span style="color:${ch.color}">${escapeHtml(ch.char)}</span>`).join('')
    ).join('\n');

    return `
      <div class="snapshot-card">
        <div class="snap-text">${textHtml}</div>
        <div class="snap-date">${dateStr}, ${timeStr}</div>
      </div>
    `;
  }).join('');
}

// ─── Init ───

renderPaper();
updateCarriagePosition(false);

// Save to localStorage periodically
setInterval(() => {
  try {
    localStorage.setItem('afteryou-lines', JSON.stringify(state.lines));
    localStorage.setItem('afteryou-snapshots', JSON.stringify(
      state.snapshots.map(s => ({ ...s, date: s.date.toISOString() }))
    ));
  } catch (e) { /* storage full or unavailable */ }
}, 5000);

// Restore from localStorage on load
(function restore() {
  try {
    const savedLines = localStorage.getItem('afteryou-lines');
    const savedSnaps = localStorage.getItem('afteryou-snapshots');

    if (savedLines) {
      state.lines = JSON.parse(savedLines);
      state.currentLine = state.lines.length - 1;
      state.currentChar = state.lines[state.currentLine].length;
      state.carriageX = INITIAL_OFFSET - (state.currentChar * CHAR_WIDTH);
      updateCarriagePosition(false);
      renderPaper();
    }

    if (savedSnaps) {
      state.snapshots = JSON.parse(savedSnaps).map(s => ({
        ...s,
        date: new Date(s.date)
      }));
    }
  } catch (e) { /* corrupt data, start fresh */ }
})();
