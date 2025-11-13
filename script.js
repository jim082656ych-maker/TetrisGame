document.addEventListener('DOMContentLoaded', () => {

    // --- 1. 遊戲設定 (Constants) ---
    const ROWS = 20;
    const COLS = 10;
    const BLOCK_SIZE = 20;
    const LEVEL_START_SPEED = 1000;
    const SHAPES = {
        'I': { shape: [[1,1,1,1]], color: '#00FFFF' },
        'J': { shape: [[1,0,0],[1,1,1]], color: '#0000FF' },
        'L': { shape: [[0,0,1],[1,1,1]], color: '#FFA500' },
        'S': { shape: [[0,1,1],[1,1,0]], color: '#00FF00' },
        'T': { shape: [[0,1,0],[1,1,1]], color: '#800080' },
        'Z': { shape: [[1,1,0],[0,1,1]], color: '#FF0000' },
        'O': { shape: [[1,1],[1,1]], color: '#FFFF00' }
    };
    const SHAPE_KEYS = 'IOTSZJL'; // [!修改] 現在是 "袋子" 的內容物
    
    let isPaused = false;
    let globalGameInterval = null;
    let allPlayers = []; 
    let currentGameMode = null; // [!新增] 儲存目前遊戲模式

    // --- 2. 玩家類別 (Player Class) ---
    class Player {
        constructor(canvasId, scoreId) {
            // ... (canvas, context, scoreElement... 不變) ...
            this.canvas = document.getElementById(canvasId);
            this.context = this.canvas.getContext('2d');
            this.scoreElement = document.getElementById(scoreId);
            this.canvas.width = COLS * BLOCK_SIZE;
            this.canvas.height = ROWS * BLOCK_SIZE;

            this.board = this.createEmptyBoard();
            this.playerPiece = null;
            this.score = 0;
            this.linesCleared = 0;
            this.gameSpeed = LEVEL_START_SPEED;
            this.gameInterval = null;
            this.garbageQueue = 0;
            this.opponent = null; 
            
            this.bag = []; // [!新增] 7-Bag Randomizer 的袋子
        }
        
        // [!新增] 7-Bag 演算法 (1): 裝滿袋子並洗牌
        fillBag() {
            const shapes = [...SHAPE_KEYS]; // 'IOTSZJL'
            
            // Fisher-Yates Shuffle (洗牌演算法)
            for (let i = shapes.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [shapes[i], shapes[j]] = [shapes[j], shapes[i]]; // ES6 交換
            }
            this.bag = shapes;
            // console.log(`P${this.canvas.id[1]} 裝滿了新袋子: ${this.bag.join(',')}`);
        }
        
        // [!新增] 7-Bag 演算法 (2): 從袋子拿一個
        getNextPieceType() {
            if (this.bag.length === 0) {
                this.fillBag();
            }
            return this.bag.pop(); // 從袋子尾巴拿一個
        }


        createEmptyBoard() {
            return Array(ROWS).fill(null).map(() => Array(COLS).fill(0));
        }

        spawnNewPiece() {
            // [!修改] 不再隨機，而是從袋子拿
            const type = this.getNextPieceType(); 
            const newPiece = { x: 4, y: 0, type: type, ...SHAPES[type] };

            if (!this.isValidMove(newPiece)) {
                this.gameOver();
            } else {
                this.playerPiece = newPiece;
            }
        }
        
        gameOver() {
            clearInterval(this.gameInterval);
            if (globalGameInterval) cancelAnimationFrame(globalGameInterval);
            globalGameInterval = null;
            isPaused = true;
            
            if (this.opponent) {
                const winnerId = this.opponent.canvas.id.replace('-board', '').toUpperCase();
                alert(`遊戲結束! ${winnerId} 獲勝!`);
            } else {
                alert(`遊戲結束! 你的分數: ${this.score}`);
            }
        }

        isValidMove(piece) {
            for (let y = 0; y < piece.shape.length; y++) {
                for (let x = 0; x < piece.shape[y].length; x++) {
                    if (piece.shape[y][x] === 1) {
                        let boardX = piece.x + x;
                        let boardY = piece.y + y;
                        if (boardX >= COLS || boardX < 0 || boardY >= ROWS) return false;
                        if (boardY < 0) continue;
                        if (this.board[boardY] && this.board[boardY][boardX] !== 0) return false;
                    }
                }
            }
            return true;
        }

        lockPiece() {
            this.playerPiece.shape.forEach((row, y) => {
                row.forEach((value, x) => {
                    if (value === 1) {
                        let boardX = this.playerPiece.x + x;
                        let boardY = this.playerPiece.y + y;
                        if(boardY >= 0) {
                             this.board[boardY][boardX] = this.playerPiece.color;
                        }
                    }
                });
            });
            this.clearLines();
        }

        clearLines() {
            let linesCleared = 0;
            for (let y = ROWS - 1; y >= 0; y--) {
                if (this.board[y].every(cell => cell !== 0)) {
                    linesCleared++;
                    this.board.splice(y, 1);
                    this.board.unshift(Array(COLS).fill(0));
                    y++; 
                }
            }
            
            if (linesCleared > 0) {
                this.score += linesCleared * 10 * linesCleared;
                this.scoreElement.textContent = this.score;
                this.linesCleared += linesCleared;
                
                if (this.opponent) {
                    let garbageToSend = linesCleared > 1 ? linesCleared - 1 : 0;
                    if (garbageToSend > 0) {
                        this.opponent.addGarbage(garbageToSend);
                    }
                }
                
                const currentLevel = Math.floor(this.linesCleared / 10);
                const newSpeed = Math.max(100, LEVEL_START_SPEED - (currentLevel * 100));
                
                if (newSpeed !== this.gameSpeed) {
                    this.gameSpeed = newSpeed;
                    clearInterval(this.gameInterval);
                    this.gameInterval = setInterval(() => this.drop(), this.gameSpeed);
                }
            }
        }

        addGarbage(lines) { this.garbageQueue += lines; }
        
        processGarbage() {
            if (this.garbageQueue === 0) return;
            const hole = Math.floor(Math.random() * COLS);
            const garbageLine = Array(COLS).fill('#777777');
            garbageLine[hole] = 0;
            for(let i=0; i < this.garbageQueue; i++) {
                this.board.shift();
                this.board.push(garbageLine);
            }
            if (this.playerPiece && !this.isValidMove(this.playerPiece)) {
                this.playerPiece.y--; 
            }
            this.garbageQueue = 0;
        }

        draw() {
            // ... (draw 函式不變) ...
            this.board.forEach((row, y) => {
                row.forEach((value, x) => {
                    this.context.fillStyle = (value === 0) ? 'black' : value;
                    this.context.fillRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
                    this.context.strokeStyle = 'rgba(50, 50, 50, 0.5)';
                    this.context.strokeRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
                });
            });
            if (this.playerPiece) {
                this.context.fillStyle = this.playerPiece.color;
                this.playerPiece.shape.forEach((row, pieceY) => {
                    row.forEach((value, pieceX) => {
                        if (value === 1) {
                            let boardX = this.playerPiece.x + pieceX;
                            let boardY = this.playerPiece.y + pieceY;
                            if(boardY >= 0) {
                                this.context.fillRect(boardX * BLOCK_SIZE, boardY * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
                            }
                        }
                    });
                });
            }
        }
        
        moveLeft() {
            let proposedMove = { ...this.playerPiece, x: this.playerPiece.x - 1 };
            if (this.isValidMove(proposedMove)) { this.playerPiece = proposedMove; }
        }
        moveRight() {
            let proposedMove = { ...this.playerPiece, x: this.playerPiece.x + 1 };
            if (this.isValidMove(proposedMove)) { this.playerPiece = proposedMove; }
        }
        rotatePiece() {
            if (this.playerPiece.type === 'O') return;
            let proposedMove = { ...this.playerPiece, shape: this.rotate(this.playerPiece.shape) };
            const kicks = [0, 1, -1, 2, -2];
            for (const kick of kicks) {
                const kickedMove = { ...proposedMove, x: proposedMove.x + kick };
                if (this.isValidMove(kickedMove)) {
                    this.playerPiece = kickedMove;
                    return;
                }
            }
        }
        rotate(matrix) {
            // (修正後的 rotate 函式不變)
            const M = matrix.length;
            const N = matrix[0].length;
            const transposed = Array(N).fill(null).map(() => Array(M).fill(0));
            for (let y = 0; y < M; y++) {
                for (let x = 0; x < N; x++) {
                    transposed[x][y] = matrix[y][x];
                }
            }
            transposed.forEach(row => row.reverse());
            return transposed;
        }

        drop() {
            let futureMove = { ...this.playerPiece, y: this.playerPiece.y + 1 };
            if (this.isValidMove(futureMove)) {
                this.playerPiece.y++;
            } else {
                this.lockPiece();
                this.processGarbage();
                this.spawnNewPiece();
            }
        }
        update() { if (!isPaused) { this.draw(); } }
        
        start() {
            this.board = this.createEmptyBoard();
            this.score = 0;
            this.scoreElement.textContent = '0';
            this.gameSpeed = LEVEL_START_SPEED;
            this.garbageQueue = 0;
            this.linesCleared = 0;
            
            this.bag = []; // [!新增] 開始遊戲時清空舊袋子
            
            this.spawnNewPiece();
            this.gameInterval = setInterval(() => this.drop(), this.gameSpeed);
        }
    }
    // --- 玩家 Class (類別) 結束 ---


    // --- 3. 遊戲啟動與控制 (含選單邏輯) ---
    const mainMenu = document.getElementById('main-menu');
    const gameArea = document.getElementById('game-area');
    const btnSinglePlayer = document.getElementById('btn-single-player');
    const btnTwoPlayer = document.getElementById('btn-two-player');
    const player1Zone = document.getElementById('player1-zone');
    const player2Zone = document.getElementById('player2-zone');
    const p1Instructions = document.getElementById('instructions-p1');
    const p2Instructions = document.getElementById('instructions-p2');
    const btnPause = document.getElementById('btn-pause');
    const btnRestart = document.getElementById('btn-restart'); 
    
    const btnRestartMatch = document.getElementById('btn-restart-match'); // [!新增] 取得新按鈕

    function gameLoop(timestamp) {
        allPlayers.forEach(player => player.update());
        if (!isPaused) { globalGameInterval = requestAnimationFrame(gameLoop); }
    }
    
    function startGame(mode) {
        // [!修改] 儲存目前模式
        currentGameMode = mode; 

        mainMenu.classList.add('hidden');
        gameArea.classList.remove('hidden');
        btnRestartMatch.classList.remove('hidden'); // [!新增] 顯示「重開」按鈕
        
        allPlayers = [];
        const player1 = new Player('p1-board', 'p1-score');
        allPlayers.push(player1);

        if (mode === 'single') {
            player2Zone.classList.add('hidden');
            p1Instructions.classList.remove('hidden');
            p2Instructions.classList.add('hidden');
        } 
        else if (mode === 'two') {
            player2Zone.classList.remove('hidden');
            p1Instructions.classList.add('hidden');
            p2Instructions.classList.remove('hidden');
            const player2 = new Player('p2-board', 'p2-score');
            allPlayers.push(player2);
            player1.opponent = player2;
            player2.opponent = player1;
        }
        
        isPaused = false;
        btnPause.textContent = "P (暫停)";
        allPlayers.forEach(player => player.start());
        
        if (globalGameInterval) cancelAnimationFrame(globalGameInterval);
        globalGameInterval = requestAnimationFrame(gameLoop);
    }
    
    function showMenu() {
        allPlayers.forEach(player => {
            if (player.gameInterval) { clearInterval(player.gameInterval); }
        });
        if (globalGameInterval) { cancelAnimationFrame(globalGameInterval); }
        globalGameInterval = null;
        allPlayers = [];
        
        mainMenu.classList.remove('hidden');
        gameArea.classList.add('hidden');
        btnRestartMatch.classList.add('hidden'); // [!新增] 回選單時隱藏「重開」按鈕
        currentGameMode = null; // [!新增] 清除模式
    }
    
    // [!新增] 重開本局的函式
    function restartGame() {
        if (currentGameMode) {
            // 停止所有舊的遊戲迴圈
            allPlayers.forEach(player => {
                if (player.gameInterval) { clearInterval(player.gameInterval); }
            });
            if (globalGameInterval) { cancelAnimationFrame(globalGameInterval); }
            globalGameInterval = null;
            
            // 用「目前」的模式，重新啟動遊戲
            startGame(currentGameMode);
        }
    }
    
    function togglePause() {
        if (!allPlayers.length) return;
        isPaused = !isPaused;
        if (isPaused) {
            allPlayers.forEach(player => clearInterval(player.gameInterval));
            if (globalGameInterval) cancelAnimationFrame(globalGameInterval);
            globalGameInterval = null;
            btnPause.textContent = "繼續";
            allPlayers.forEach(player => {
                player.context.fillStyle = 'rgba(255, 255, 255, 0.7)';
                player.context.fillRect(0, 0, player.canvas.width, player.canvas.height);
                player.context.font = '30px Arial';
                player.context.fillStyle = 'black';
                player.context.textAlign = 'center';
                player.context.fillText('PAUSED', player.canvas.width / 2, player.canvas.height / 2);
            });
        } else {
            allPlayers.forEach(player => {
                player.gameInterval = setInterval(() => player.drop(), player.gameSpeed);
            });
            btnPause.textContent = "P (暫停)";
            requestAnimationFrame(gameLoop);
        }
    }

    // 鍵盤控制 (不變)
    document.addEventListener('keydown', (event) => {
        if (event.key === 'p' || event.key === 'P') { togglePause(); return; }
        if (isPaused || !allPlayers.length) return; 
        if (allPlayers[0] && allPlayers[0].playerPiece) { 
            if (event.key === 'ArrowLeft') { allPlayers[0].moveLeft(); allPlayers[0].draw(); }
            else if (event.key === 'ArrowRight') { allPlayers[0].moveRight(); allPlayers[0].draw(); }
            else if (event.key === 'ArrowDown') { allPlayers[0].drop(); allPlayers[0].draw(); }
            else if (event.key === 'ArrowUp') { allPlayers[0].rotatePiece(); allPlayers[0].draw(); }
        }
        if (allPlayers[1] && allPlayers[1].playerPiece) { 
            if (event.key === 'a' || event.key === 'A') { allPlayers[1].moveLeft(); allPlayers[1].draw(); }
            else if (event.key === 'd' || event.key === 'D') { allPlayers[1].moveRight(); allPlayers[1].draw(); }
            else if (event.key === 's' || event.key === 'S') { allPlayers[1].drop(); allPlayers[1].draw(); }
            else if (event.key === 'w' || event.key === 'W') { allPlayers[1].rotatePiece(); allPlayers[1].draw(); }
        }
    });

    // 3.7 按鈕監聽 (!! 修改 !!)
    btnSinglePlayer.addEventListener('click', () => startGame('single'));
    btnTwoPlayer.addEventListener('click', () => startGame('two'));
    btnPause.addEventListener('click', togglePause);
    btnRestart.addEventListener('click', showMenu); // 舊的「回選單」
    btnRestartMatch.addEventListener('click', restartGame); // [!新增] 新的「重開本局」

});
