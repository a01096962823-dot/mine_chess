// game.js
// 지뢰 체스 – 단순 전역 버전 (캡처 하이라이트 + 폭발 연출 포함)

// === 기본 보드 / 기물 ===
const INITIAL_BOARD = [
  ['bR','bN','bB','bQ','bK','bB','bN','bR'],
  ['bP','bP','bP','bP','bP','bP','bP','bP'],
  ['','','','','','','',''],
  ['','','','','','','',''],
  ['','','','','','','',''],
  ['','','','','','','',''],
  ['wP','wP','wP','wP','wP','wP','wP','wP'],
  ['wR','wN','wB','wQ','wK','wB','wN','wR']
];

const PIECE_SYMBOLS = {
  wP: '♙', wR: '♖', wN: '♘', wB: '♗', wQ: '♕', wK: '♔',
  bP: '♟', bR: '♜', bN: '♞', bB: '♝', bQ: '♛', bK: '♚'
};

// === 전역 상태 ===
let board;
let mines;
let exploded;
let whiteTurn;
let selected;              // {row, col} 또는 null
let highlightedMoves;      // 빈칸 이동
let highlightedCaptures;   // 상대 기물 캡처
let gameOver;
let boomTimer;

// DOM 요소
let boardEl;
let statusEl;
let logEl;
let resetBtn;
let boomToastEl;

// === 유틸 함수 ===
function cloneBoard(b) {
  return b.map(row => row.slice());
}
function inBounds(r, c) {
  return r >= 0 && r < 8 && c >= 0 && c < 8;
}
function pieceToChar(p) {
  return PIECE_SYMBOLS[p] || '?';
}
function isKingAlive(b, color) {
  const king = color + 'K';
  return b.some(row => row.includes(king));
}
function logMessage(msg) {
  if (!logEl) return;
  const div = document.createElement('div');
  div.textContent = msg;
  logEl.prepend(div);
}
function showBoomToast(message) {
  if (!boomToastEl) return;
  boomToastEl.textContent = message;
  if (boomTimer) clearTimeout(boomTimer);
  boomToastEl.classList.add('show-boom');
  boomTimer = setTimeout(() => {
    boomToastEl.classList.remove('show-boom');
  }, 900);
}

// === 지뢰 생성 (전체 칸의 약 10%) ===
function generateMines() {
  const m = Array.from({ length: 8 }, () => Array(8).fill(false));
  const totalCells = 8 * 8;
  const mineCount = Math.max(1, Math.round(totalCells / 10)); // ≈ 6개

  let placed = 0;
  while (placed < mineCount) {
    const r = Math.floor(Math.random() * 8);
    const c = Math.floor(Math.random() * 8);
    if (!m[r][c]) {
      m[r][c] = true;
      placed++;
    }
  }
  return m;
}

// === 이동 가능 칸 계산 (capture 여부 포함) ===
// 반환: [{row, col, capture: true/false}, ...]
function generateMoves(b, fr, fc) {
  const moves = [];
  const piece = b[fr][fc];
  if (!piece) return moves;

  const color = piece[0];
  const type = piece[1];

  function addSlidingMoves(dr, dc) {
    let r = fr + dr;
    let c = fc + dc;
    while (inBounds(r, c)) {
      const target = b[r][c];
      if (!target) {
        moves.push({ row: r, col: c, capture: false });
      } else {
        if (target[0] !== color) moves.push({ row: r, col: c, capture: true });
        break;
      }
      r += dr;
      c += dc;
    }
  }

  if (type === 'P') {
    const dir = color === 'w' ? -1 : 1;
    const startRow = color === 'w' ? 6 : 1;
    const one = fr + dir;

    // 앞으로 한 칸 (빈칸)
    if (inBounds(one, fc) && !b[one][fc]) {
      moves.push({ row: one, col: fc, capture: false });
    }
    // 처음 위치일 때 두 칸
    const two = fr + 2 * dir;
    if (fr === startRow && inBounds(two, fc) &&
        !b[one][fc] && !b[two][fc]) {
      moves.push({ row: two, col: fc, capture: false });
    }
    // 대각선 캡처
    const caps = [[dir, -1], [dir, 1]];
    for (const [dr, dc] of caps) {
      const r = fr + dr;
      const c = fc + dc;
      if (inBounds(r, c) && b[r][c] && b[r][c][0] !== color) {
        moves.push({ row: r, col: c, capture: true });
      }
    }
  } else if (type === 'R') {
    addSlidingMoves(-1, 0);
    addSlidingMoves(1, 0);
    addSlidingMoves(0, -1);
    addSlidingMoves(0, 1);
  } else if (type === 'B') {
    addSlidingMoves(-1, -1);
    addSlidingMoves(-1, 1);
    addSlidingMoves(1, -1);
    addSlidingMoves(1, 1);
  } else if (type === 'Q') {
    addSlidingMoves(-1, 0);
    addSlidingMoves(1, 0);
    addSlidingMoves(0, -1);
    addSlidingMoves(0, 1);
    addSlidingMoves(-1, -1);
    addSlidingMoves(-1, 1);
    addSlidingMoves(1, -1);
    addSlidingMoves(1, 1);
  } else if (type === 'N') {
    const jumps = [
      [-2,-1],[-2,1],[-1,-2],[-1,2],
      [1,-2],[1,2],[2,-1],[2,1]
    ];
    for (const [dr, dc] of jumps) {
      const r = fr + dr;
      const c = fc + dc;
      if (!inBounds(r, c)) continue;
      const target = b[r][c];
      if (!target) {
        moves.push({ row: r, col: c, capture: false });
      } else if (target[0] !== color) {
        moves.push({ row: r, col: c, capture: true });
      }
    }
  } else if (type === 'K') {
    const steps = [
      [-1,-1],[-1,0],[-1,1],
      [0,-1],       [0,1],
      [1,-1],[1,0],[1,1]
    ];
    for (const [dr, dc] of steps) {
      const r = fr + dr;
      const c = fc + dc;
      if (!inBounds(r, c)) continue;
      const target = b[r][c];
      if (!target) {
        moves.push({ row: r, col: c, capture: false });
      } else if (target[0] !== color) {
        moves.push({ row: r, col: c, capture: true });
      }
    }
  }

  return moves;
}

// === 실제 이동 처리 ===
function makeMove(fromR, fromC, toR, toC) {
  const piece = board[fromR][fromC];
  const color = piece[0];
  const target = board[toR][toC];

  board[fromR][fromC] = '';
  board[toR][toC] = piece;

  const colorName = color === 'w' ? '백' : '흑';

  if (mines[toR][toC]) {
    mines[toR][toC] = false;
    exploded[toR][toC] = true;
    board[toR][toC] = '';
    const msg = `${colorName}의 기물이 지뢰를 밟고 폭발했습니다! (${toR}, ${toC})`;
    logMessage('💥 ' + msg);
    showBoomToast(msg);
  } else if (target && target[1] === 'K') {
    const msg = `${colorName}이(가) 상대 왕을 잡었습니다!`;
    logMessage('♚ ' + msg);
    showBoomToast(msg);
  }

  const whiteAlive = isKingAlive(board, 'w');
  const blackAlive = isKingAlive(board, 'b');

  if (!whiteAlive && !blackAlive) {
    gameOver = true;
    statusEl.textContent = '두 왕이 모두 사라졌습니다. 무승부입니다.';
    return;
  }
  if (!whiteAlive) {
    gameOver = true;
    statusEl.textContent = '백 왕이 사라졌습니다. 흑의 승리!';
    return;
  }
  if (!blackAlive) {
    gameOver = true;
    statusEl.textContent = '흑 왕이 사라졌습니다. 백의 승리!';
    return;
  }

  whiteTurn = !whiteTurn;
  updateStatus();
}

function updateStatus() {
  if (gameOver) return;
  statusEl.textContent = whiteTurn ? '백 차례입니다.' : '흑 차례입니다.';
}

// === 보드 렌더링 ===
function renderBoard() {
  boardEl.innerHTML = '';

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const cell = document.createElement('div');
      cell.classList.add('cell');
      cell.classList.add((r + c) % 2 === 0 ? 'light' : 'dark');
      cell.dataset.row = r;
      cell.dataset.col = c;

      const piece = board[r][c];
      if (piece) {
        cell.textContent = pieceToChar(piece);
      }

      if (exploded[r][c]) {
        cell.classList.add('exploded');
        cell.textContent = '💥';
      }

      if (selected && selected.row === r && selected.col === c) {
        cell.classList.add('selected');
      }

      if (highlightedMoves.some(m => m.row === r && m.col === c)) {
        cell.classList.add('highlight-move');
      }
      if (highlightedCaptures.some(m => m.row === r && m.col === c)) {
        cell.classList.add('highlight-capture');
      }

      cell.addEventListener('click', onCellClick);
      boardEl.appendChild(cell);
    }
  }
}

// === 셀 클릭 처리 ===
function onCellClick() {
  if (gameOver) return;

  const r = parseInt(this.dataset.row, 10);
  const c = parseInt(this.dataset.col, 10);
  const piece = board[r][c];

  // 아무 것도 선택 안 된 상태
  if (!selected) {
    if (!piece) return;
    const color = piece[0];
    if (whiteTurn && color !== 'w') return;
    if (!whiteTurn && color !== 'b') return;

    selected = { row: r, col: c };
    const moves = generateMoves(board, r, c);
    highlightedMoves = moves.filter(m => !m.capture);
    highlightedCaptures = moves.filter(m => m.capture);
    renderBoard();
    return;
  }

  // 같은 칸 다시 클릭 → 선택 해제
  if (selected.row === r && selected.col === c) {
    selected = null;
    highlightedMoves = [];
    highlightedCaptures = [];
    renderBoard();
    return;
  }

  const fromR = selected.row;
  const fromC = selected.col;
  const fromPiece = board[fromR][fromC];
  if (!fromPiece) {
    selected = null;
    highlightedMoves = [];
    highlightedCaptures = [];
    renderBoard();
    return;
  }
  const fromColor = fromPiece[0];

  // 같은 색 말이 있는 칸 → 선택 말 변경
  if (piece && piece[0] === fromColor) {
    selected = { row: r, col: c };
    const moves = generateMoves(board, r, c);
    highlightedMoves = moves.filter(m => !m.capture);
    highlightedCaptures = moves.filter(m => m.capture);
    renderBoard();
    return;
  }

  // 합법적인 움직임인지 확인
  const legalMoves = generateMoves(board, fromR, fromC);
  const isLegal = legalMoves.some(m => m.row === r && m.col === c);
  if (!isLegal) return;

  makeMove(fromR, fromC, r, c);
  selected = null;
  highlightedMoves = [];
  highlightedCaptures = [];
  renderBoard();
}

// === 초기화 ===
function initGame() {
  board = cloneBoard(INITIAL_BOARD);
  mines = generateMines();
  exploded = Array.from({ length: 8 }, () => Array(8).fill(false));
  whiteTurn = true;
  selected = null;
  highlightedMoves = [];
  highlightedCaptures = [];
  gameOver = false;

  if (logEl) logEl.innerHTML = '';
  logMessage('새 게임 시작! 보드 전체 칸의 약 10%에 지뢰가 숨어 있습니다...');

  renderBoard();
  updateStatus();
}

function init() {
  boardEl = document.getElementById('board');
  statusEl = document.getElementById('status');
  logEl = document.getElementById('log');
  resetBtn = document.getElementById('resetBtn');
  boomToastEl = document.getElementById('boomToast');

  resetBtn.addEventListener('click', initGame);

  initGame();
}

// DOM 준비 후 시작
document.addEventListener('DOMContentLoaded', init);
