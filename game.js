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
    highlightedMoves: [],     // 빈칸으로 이동하는 칸
    highlightedCaptures: [],  // 상대 기물을 잡을 수 있는 칸
    gameOver: false,
    boomTimer: null,
    elements: {
      boardEl: null,
      statusEl: null,
      logEl: null,
      resetBtn: null,
      boomToast: null
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

  // 화면 상단에 잠깐 뜨는 폭발 토스트
  const showBoomToast = (message) => {
    const el = state.elements.boomToast;
    if (!el) return;
    el.textContent = message;

    // 기존 타이머 있으면 제거
    if (state.boomTimer) clearTimeout(state.boomTimer);

    el.classList.add('show-boom');
    state.boomTimer = setTimeout(() => {
      el.classList.remove('show-boom');
    }, 900);
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
  // 각 move: { row, col, capture: boolean }
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
          moves.push({ row: r, col: c, capture: false });
        } else {
          if (target[0] !== color) {
            moves.push({ row: r, col: c, capture: true });
          }
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

      // 앞으로 한 칸 (빈칸만)
      if (inBounds(one, fc) && !board[one][fc]) {
        moves.push({ row: one, col: fc, capture: false });
      }

      // 처음 위치면 두 칸
      const two = fr + 2 * dir;
      if (fr === startRow && inBounds(two, fc) &&
          !board[one][fc] && !board[two][fc]) {
        moves.push({ row: two, col: fc, capture: false });
      }

      // 대각선 잡기
      const caps = [[dir, -1], [dir, 1]];
      for (const [dr, dc] of caps) {
        const r = fr + dr;
        const c = fc + dc;
        if (inBounds(r, c) && board[r][c] && board[r][c][0] !== color) {
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
        const target = board[r][c];
        if (!target) {
          moves.push({ row: r, col: c, capture: false });
        } else if (target[0] !== color) {
          moves.push({ row: r, col: c, capture: true });
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
        if (!target) {
          moves.push({ row: r, col: c, capture: false });
        } else if (target[0] !== color) {
          moves.push({ row: r, col: c, capture: true });
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

  con
