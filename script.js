// --- 1. 遊戲設定 (Constants) ---
const canvas = document.getElementById('tetris-board');
const context = canvas.getContext('2d');
const scoreElement = document.getElementById('score');

const ROWS = 20;
const COLS = 10;
const BLOCK_SIZE = 20;

// --- 2. 動態設定畫布大小 ---
canvas.width = COLS * BLOCK_SIZE;
canvas.height = ROWS * BLOCK_SIZE;

// --- 3. 定義方塊 (Tetrominoes) ---
const SHAPES = {
    'I': { shape: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], color: '#00FFFF' },
    'J': { shape: [[1,0,0],[1,1,1],[0,0,0]], color: '#0000FF' },
    'L': { shape: [[0,0,1],[1,1,1],[0,0,0]], color: '#FFA500' },
    'S': { shape: [[0,1,1],[1,1,0],[0,0,0]], color: '#00FF00' },
    'T': { shape: [[0,1,0],[1,1,1],[0,0,0]], color: '#800080' },
    'Z': { shape: [[1,1,0],[0,1,1],[0,0,0]], color: '#FF0000' },
    'O': { shape: [[1,1],[1,1]], color: '#FFFF00' }
};
const SHAPE_KEYS = 'IOTSZJL';

// --- 4. 建立遊戲網格 (Board) ---
function createEmptyBoard() {
    return Array(ROWS).fill(null).map(() => Array(COLS).fill(0));
}
let board = createEmptyBoard();

// --- 5. 玩家方塊 & 遊戲狀態 ---
let playerPiece = null;
let score = 0;
let gameInterval = null;
let isPaused = false;

// 5.1 產生一個新方塊
function spawnNewPiece() {
    const type = SHAPE_KEYS[Math.floor(Math.random() * SHAPE_KEYS.length)];
    playerPiece = { x: 4, y: 0, type: type, ...SHAPES[type] };

    if (!isValidMove(playerPiece)) {
        alert('遊戲結束! 您的分數: ' + score);
        clearInterval(gameInterval);
        isPaused = true;
    }
}

// --- 6. 碰撞偵測 (Collision Detection) ---
// 6.1 檢查是否為有效移動 (不變)
function isValidMove(piece) {
    for (let y = 0; y < piece.shape.length; y++) {
        for (let x = 0; x < piece.shape[y].length; x++) {
            if (piece.shape[y][x] === 1) {
                let boardX = piece.x + x;
                let boardY = piece.y + y;
                if (boardX >= COLS || boardX < 0 || boardY >= ROWS) return false;
                if (board[boardY] && board[boardY][boardX] !== 0) return false;
            }
        }
    }
    return true;
}

// 6.2 將方塊鎖定 (固定) 在網格上 (不變)
function lockPiece() {
    playerPiece.shape.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value === 1) {
                let boardX = playerPiece.x + x;
                let boardY = playerPiece.y + y;
                board[boardY][boardX] = playerPiece.color;
            }
        });
    });
    clearLines();
}

// 6.3 消除橫列 (不變)
function clearLines() {
    let linesCleared = 0;
    for (let y = ROWS - 1; y >= 0; y--) {
        if (board[y].every(cell => cell !== 0)) {
            linesCleared++;
            board.splice(y, 1);
            board.unshift(Array(COLS).fill(0));
            y++; 
        }
    }
    if (linesCleared > 0) {
        score += linesCleared * 10;
        scoreElement.textContent = score;
    }
}

// --- 7. 繪製遊戲畫面 (Draw Function) --- (不變)
function draw() {
    // 7.1. 繪製背景
    board.forEach((row, y) => {
        row.forEach((value, x) => {
            context.fillStyle = (value === 0) ? 'black' : value;
            context.fillRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
            context.strokeStyle = 'rgba(50, 50, 50, 0.5)';
            context.strokeRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
        });
    });

    // 7.2. 繪製玩家方塊
    if (playerPiece) {
        context.fillStyle = playerPiece.color;
        playerPiece.shape.forEach((row, pieceY) => {
            row.forEach((value, pieceX) => {
                if (value === 1) {
                    let boardX = playerPiece.x + pieceX;
                    let boardY = playerPiece.y + pieceY;
                    context.fillRect(boardX * BLOCK_SIZE, boardY * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
                }
            });
        });
    }
    
    // 7.3 繪製暫停畫面
    if (isPaused) {
        context.fillStyle = 'rgba(255, 255, 255, 0.7)';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.font = '30px Arial';
        context.fillStyle = 'black';
        context.textAlign = 'center';
        context.fillText('PAUSED', canvas.width / 2, canvas.height / 2);
    }
}

// --- 8. 遊戲邏輯 (Game Logic) ---
// 8.1 方塊掉落 (不變)
function drop() {
    if (isPaused) return; // 【!! 新增 !!】 暫停時不能掉落
    let futureMove = { ...playerPiece, y: playerPiece.y + 1 };
    if (isValidMove(futureMove)) {
        playerPiece.y++;
    } else {
        lockPiece();
        spawnNewPiece();
    }
    draw();
}

// 8.2 旋轉方塊 (不變)
function rotate(matrix) {
    const N = matrix.length;
    const newMatrix = Array(N).fill(null).map(() => Array(N).fill(0));
    for (let y = 0; y < N; y++) {
        for (let x = 0; x < N; x++) {
            newMatrix[x][y] = matrix[y][x];
        }
    }
    newMatrix.forEach(row => row.reverse());
    return newMatrix;
}

// 8.3 暫停/繼續 遊戲 (不變)
function togglePause() {
    if (isPaused) {
        isPaused = false;
        gameInterval = setInterval(drop, 1000);
        draw();
    } else {
        isPaused = true;
        clearInterval(gameInterval);
        draw();
    }
}

// 【!! 以下為 8.4 ~ 8.7, 都是重構新增的 !!】

// 8.4 【!! 新函式 !!】 (從 handleKeyPress 拆分出來)
function moveLeft() {
    if (isPaused) return;
    let proposedMove = { ...playerPiece, x: playerPiece.x - 1 };
    if (isValidMove(proposedMove)) {
        playerPiece = proposedMove;
        draw();
    }
}

// 8.5 【!! 新函式 !!】 (從 handleKeyPress 拆分出來)
function moveRight() {
    if (isPaused) return;
    let proposedMove = { ...playerPiece, x: playerPiece.x + 1 };
    if (isValidMove(proposedMove)) {
        playerPiece = proposedMove;
        draw();
    }
}

// 8.6 【!! 新函式 !!】 (從 handleKeyPress 拆分出來)
function rotatePiece() {
    if (isPaused) return;
    if (playerPiece.type === 'O') return; // O 方塊不用轉
    
    let proposedMove = { 
        ...playerPiece, 
        shape: rotate(playerPiece.shape)
    };
    
    if (isValidMove(proposedMove)) {
        playerPiece = proposedMove;
        draw();
    }
}

// 8.7 【!! 修改 !!】 鍵盤控制 (現在只負責 "呼叫")
function handleKeyPress(event) {
    
    if (event.key === 'p' || event.key === 'P') {
        togglePause();
        return;
    }

    if (isPaused) {
        return;
    }
    
    if (event.key === 'ArrowLeft') {
        moveLeft();
    } else if (event.key === 'ArrowRight') {
        moveRight();
    } else if (event.key === 'ArrowDown') {
        drop(); // 按下 [下] 鍵, 直接呼叫 drop()
    } else if (event.key === 'ArrowUp') {
        rotatePiece();
    }
}

// --- 9. 啟動遊戲 ---
function startGame() {
    board = createEmptyBoard();
    score = 0;
    scoreElement.textContent = score;
    isPaused = false;
    spawnNewPiece();
    draw();
    
    if (gameInterval) {
        clearInterval(gameInterval);
    }
    gameInterval = setInterval(drop, 1000);
}

// 9.1 啟動鍵盤監聽
document.addEventListener('keydown', handleKeyPress);

// 9.2 【!! 新增 !!】 啟動觸控按鈕監聽
document.getElementById('btn-left').addEventListener('click', moveLeft);
document.getElementById('btn-right').addEventListener('click', moveRight);
document.getElementById('btn-down').addEventListener('click', drop); // 按鈕的 "下" 也是呼叫 drop
document.getElementById('btn-rotate').addEventListener('click', rotatePiece);
document.getElementById('btn-pause').addEventListener('click', togglePause);

// 9.3 呼叫 startGame() 來啟動
startGame();
