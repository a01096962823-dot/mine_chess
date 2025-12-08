// game.js
// 지뢰 체스 – 게임 로직 모듈

const MineChess = (() => {
  // --- 상수 / 기본 보드 ---

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

  // --- 상태 ---

  const state = {
    board: null,
    mines: null,
    exploded: null,
    whiteTurn: true,
    selected: null,
    highlighted: [],
    gameOver: false,
    elements: {
      boardEl: null,
      statusEl: null,
      logEl: null,
      resetBtn: null
    }
  };

  // --- 유틸 ---

  const cloneBoard = (board) => board.map(row => row.slice());

  const inBounds = (r, c) =>
    r >= 0 && r < 8 && c >= 0 && c < 8;

  const pieceToChar = (p) => PIECE_SYMBOLS[p] || '?';

  const isKingAlive = (board, color) => {
    const king = color + 'K';
    return board.some(row => row.includes(king));
  };

  const logMessage = (msg) => {
    const { logEl } = state.elements;
    if (!logEl) return;
    const div = document.createElement('div');
    div.textContent = msg;
    logEl.prepend(div);
  };

  // --- 지뢰 생성 ---

  const generateMines = () => {
    const mines = Array.from({ length: 8 }, () => Array(8).fill(false));
    const totalCells = 8 * 8;
    const mineCount = Math.max(1, Math.round(totalCells / 10)); // ≈ 6개

    let placed = 0;
    while (placed < mineCount) {
      const r = Math.floor(Math.random() * 8);
      const c = Math.floor(Math.random() * 8);
      if (!mines[r][c]) {
        mines[r][c] = true;
        placed++;
      }
    }
    return mines;
  };

  // --- 말 이동 가능 칸 계산 ---

  const generateMoves = (board, fr, fc) => {
    const moves = [];
    const piece = board[fr][fc];
    if (!piece) return moves;

    const color = piece[0];
    const type = piece[1];

    const addSlidingMoves = (dr, dc) => {
      let r = fr + dr;
      let c = fc + dc;
      while (inBounds(r, c)) {
        const target = board[r][c];
        if (!target) {
          moves.push({ row: r, col: c });
        } else {
          if (target[0] !== color) moves.push({ row: r, col: c });
          break;
        }
        r += dr;
        c += dc;
      }
    };

    if (type === 'P') {
      const dir = color === 'w' ? -1 : 1;
      const startRow = color === 'w' ? 6 : 1;
      const one = fr + dir;

      if (inBounds(one, fc) && !board[one][fc]) {
        moves.push({ row: one, col: fc });
      }

      const two = fr + 2 * dir;
      if (fr === startRow && inBounds(two, fc) &&
          !board[one][fc] && !board[two][fc]) {
        moves.push({ row: two, col: fc });
      }

      const caps = [[dir, -1], [dir, 1]];
      for (const [dr, dc] of caps) {
        const r = fr + dr;
        const c = fc + dc;
        if (inBounds(r, c) && board[r][c] && board[r][c][0] !== color) {
          moves.push({ row: r, col: c });
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
        const target = board[r][c];
        if (!target || target[0] !== color) {
          moves.push({ row: r, col: c });
        }
      }
    } else if (type === 'K') {
      const steps = [
        [-1,-1],[-1,0],[-1,1],
        [0,-1],        [0,1],
        [1,-1],[1,0],[1,1]
      ];
      for (const [dr, dc] of steps) {
        const r = fr + dr;
        const c = fc + dc;
        if (!inBounds(r, c)) continue;
        const target = board[r][c];
        if (!target || target[0] !== color) {
          moves.push({ row: r, col: c });
        }
      }
    }

    return moves;
  };

  // --- 이동 적용 / 룰 ---

  const makeMove = (fromR, fromC, toR, toC) => {
    const { board, mines, exploded } = state;
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
      logMessage(`${colorName}의 기물이 지뢰를 밟고 폭발했습니다! (${toR}, ${toC})`);
    } else if (target && target[1] === 'K') {
      logMessage(`${colorName}이(가) 상대 왕을 잡었습니다!`);
    }

    const whiteAlive = isKingAlive(board, 'w');
    const blackAlive = isKingAlive(board, 'b');

    if (!whiteAlive && !blackAlive) {
      state.gameOver = true;
      state.elements.statusEl.textContent = '두 왕이 모두 사라졌습니다. 무승부입니다.';
      return;
    }
    if (!whiteAlive) {
      state.gameOver = true;
      state.elements.statusEl.textContent = '백 왕이 사라졌습니다. 흑의 승리!';
      return;
    }
    if (!blackAlive) {
      state.gameOver = true;
      state.elements.statusEl.textContent = '흑 왕이 사라졌습니다. 백의 승리!';
      return;
    }

    state.whiteTurn = !state.whiteTurn;
    updateStatus();
  };

  const updateStatus = () => {
    if (state.gameOver) return;
    const { statusEl } = state.elements;
    statusEl.textContent = state.whiteTurn ? '백 차례입니다.' : '흑 차례입니다.';
  };

  // --- 렌더링 ---

  const renderBoard = () => {
    const { board, exploded, selected, highlighted } = state;
    const { boardEl } = state.elements;
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

        if (highlighted.some(m => m.row === r && m.col === c)) {
          cell.classList.add('highlight-move');
        }

        boardEl.appendChild(cell);
      }
    }
  };

  // --- 이벤트 처리 ---

  const handleBoardClick = (event) => {
    if (state.gameOver) return;

    const cell = event.target.closest('.cell');
    if (!cell) return;

    const r = parseInt(cell.dataset.row, 10);
    const c = parseInt(cell.dataset.col, 10);
    const piece = state.board[r][c];

    const { selected, board, whiteTurn } = state;

    // 선택된 말이 없는 상태
    if (!selected) {
      if (!piece) return;
      const color = piece[0];
      if (whiteTurn && color !== 'w') return;
      if (!whiteTurn && color !== 'b') return;

      state.selected = { row: r, col: c };
      state.highlighted = generateMoves(board, r, c);
      renderBoard();
      return;
    }

    // 같은 칸 다시 클릭 → 선택 해제
    if (selected.row === r && selected.col === c) {
      state.selected = null;
      state.highlighted = [];
      renderBoard();
      return;
    }

    const fromR = selected.row;
    const fromC = selected.col;
    const fromPiece = board[fromR][fromC];
    if (!fromPiece) {
      state.selected = null;
      state.highlighted = [];
      renderBoard();
      return;
    }
    const fromColor = fromPiece[0];

    // 같은 색 말 있는 칸 클릭 → 선택 말 변경
    if (piece && piece[0] === fromColor) {
      state.selected = { row: r, col: c };
      state.highlighted = generateMoves(board, r, c);
      renderBoard();
      return;
    }

    // 이동 가능한 칸인지 확인
    const legalMoves = generateMoves(board, fromR, fromC);
    const isLegal = legalMoves.some(m => m.row === r && m.col === c);
    if (!isLegal) return;

    makeMove(fromR, fromC, r, c);
    state.selected = null;
    state.highlighted = [];
    renderBoard();
  };

  // --- 초기화 ---

  const initState = () => {
    state.board = cloneBoard(INITIAL_BOARD);
    state.mines = generateMines();
    state.exploded = Array.from({ length: 8 }, () => Array(8).fill(false));
    state.whiteTurn = true;
    state.selected = null;
    state.highlighted = [];
    state.gameOver = false;

    const { logEl } = state.elements;
    if (logEl) logEl.innerHTML = '';
    logMessage('새 게임 시작! 보드 전체 칸의 약 10%에 지뢰가 숨어 있습니다...');

    renderBoard();
    updateStatus();
  };

  const init = () => {
    state.elements.boardEl = document.getElementById('board');
    state.elements.statusEl = document.getElementById('status');
    state.elements.logEl = document.getElementById('log');
    state.elements.resetBtn = document.getElementById('resetBtn');

    state.elements.boardEl.addEventListener('click', handleBoardClick);
    state.elements.resetBtn.addEventListener('click', initState);

    initState();
  };

  return { init };
})();

// DOM이 준비되면 초기화
document.addEventListener('DOMContentLoaded', () => {
  MineChess.init();
});
