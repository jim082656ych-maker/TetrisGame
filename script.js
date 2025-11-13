document.addEventListener('DOMContentLoaded', () => {

    // --- 0. [! 大修改 !] 裝置偵測 v6.1 ---
    let isMobile = false;
    function detectDevice() {
        // [!修改!] 我們不再用 userAgent，我們改用「螢幕寬度」。
        // 768px 是平板電腦的標準分界線
        isMobile = (window.innerWidth <= 768); 
        console.log(`Device check: isMobile = ${isMobile} (Screen width: ${window.innerWidth}px)`);
    }
    detectDevice(); // 馬上偵測
    // --- (0. 結束) ---


    // --- 1. 遊戲設定 (Constants) ---
    const ROWS = 20;
    const COLS = 10;
    // [!修改!] 這裡的邏輯現在會 100% 正確
    const BLOCK_SIZE = isMobile ? 18 : 20;
    const LEVEL_START_SPEED = 1000;
    const GOAL_LINES = 100;
    
    // ... (SHAPES, SHAPE_KEYS, GREY_COLOR ... 不變)
    const SHAPES = {
        'I': { shape: [[1,1,1,1]], color: '#00FFFF' },
        'J': { shape: [[1,0,0],[1,1,1]], color: '#0000FF' },
        'L': { shape: [[0,0,1],[1,1,1]], color: '#FFA500' },
        'S': { shape: [[0,1,1],[1,1,0]], color: '#00FF00' },
        'T': { shape: [[0,1,0],[1,1,1]], color: '#800080' },
        'Z': { shape: [[1,1,0],[0,1,1]], color: '#FF0000' },
        'O': { shape: [[1,1],[1,1]], color: '#FFFF00' }
    };
    const SHAPE_KEYS = 'IOTSZJL';
    const GREY_COLOR = '#777777';
    
    let isPaused = false;
    let globalGameInterval = null;
    let allPlayers = []; 
    let currentGameMode = null;
    let fireworksLoopId = null;

    // --- 2. 玩家類別 (Player Class) ---
    // (這整段 v6.0 的 class Player { ... } 程式碼，一個字都不用改，
    //  我完整貼上，確保你不會出錯)
    class Player {
        constructor(canvasId, scoreId) {
            this.canvas = document.getElementById(canvasId);
            this.context = this.canvas.getContext('2d');
            this.scoreElement = document.getElementById(scoreId);
            this.canvas.width = COLS * BLOCK_SIZE;
            this.canvas.height = ROWS * BLOCK_SIZE;
            this.board = this.createEmptyBoard();
            this.playerPiece = null;
            this.score = 0;
            this.totalLinesCleared = 0;
            this.gameSpeed = LEVEL_START_SPEED;
            this.gameInterval = null; // 這個在 v6.0 沒用了，但先留著
            this.lastDropTime = 0; // [!新增!] v6.0 的新計時器
            this.garbageQueue = 0;
            this.opponent = null; 
            this.bag = [];
        }
        fillBag() {
            const shapes = [...SHAPE_KEYS];
            for (let i = shapes.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [shapes[i], shapes[j]] = [shapes[j], shapes[i]];
            }
            this.bag = shapes;
        }
        getNextPieceType() {
            if (this.bag.length === 0) { this.fillBag(); }
            return this.bag.pop();
        }
        createEmptyBoard() {
            return Array(ROWS).fill(null).map(() => Array(COLS).fill(0));
        }
        spawnNewPiece() {
            const type = this.getNextPieceType(); 
            const newPiece = { x: 4, y: 0, type: type, ...SHAPES[type] };
            if (!this.isValidMove(newPiece)) {
                this.gameOver(false);
            } else {
                this.playerPiece = newPiece;
            }
        }
        gameOver(didWin = false) {
            clearInterval(this.gameInterval); // 雖然沒用，但保險
            if (globalGameInterval) cancelAnimationFrame(globalGameInterval);
            globalGameInterval = null;
            isPaused = true;
            if (didWin) {
                showGameWonScreen(this);
            }
            else if (this.opponent) {
                this.opponent.opponentWon(); 
            } else {
                alert(`遊戲結束! 你的分數: ${this.score}`);
            }
        }
        opponentWon() {
            clearInterval(this.gameInterval);
            if (globalGameInterval) cancelAnimationFrame(globalGameInterval);
            globalGameInterval = null;
            isPaused = true;
            showGameWonScreen(this);
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
                if (this.board[y].every(cell => cell !== 0 && cell !== GREY_COLOR)) { 
                    linesCleared++;
                    this.board.splice(y, 1);
                    this.board.unshift(Array(COLS).fill(0));
                    y++; 
                }
            }
            if (linesCleared > 0) {
                this.score += linesCleared * 10 * linesCleared;
                this.scoreElement.textContent = this.score;
                this.totalLinesCleared += linesCleared;
                if (currentGameMode === 'single') {
                    p1GoalLines.textContent = `${this.totalLinesCleared}`;
                    if (this.totalLinesCleared >= GOAL_LINES) {
                        this.gameOver(true);
                        return; 
                    }
                }
                if (this.opponent) {
                    let garbageToSend = linesCleared > 1 ? linesCleared - 1 : 0;
                    if (garbageToSend > 0) { this.opponent.addGarbage(garbageToSend); }
                }
                const currentLevel = Math.floor(this.totalLinesCleared / 10);
                const newSpeed = Math.max(100, LEVEL_START_SPEED - (currentLevel * 100));
                if (newSpeed !== this.gameSpeed) {
                    this.gameSpeed = newSpeed;
                    // (v6.0 移除了 setInterval, 所以這裡不用動)
                }
            }
        }
        addGarbage(lines) { this.garbageQueue += lines; }
        processGarbage() {
            if (this.garbageQueue === 0) return;
            const hole = Math.floor(Math.random() * COLS);
            const garbageLine = Array(COLS).fill(GREY_COLOR);
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
            if(isPaused || !this.playerPiece) return;
            let proposedMove = { ...this.playerPiece, x: this.playerPiece.x - 1 };
            if (this.isValidMove(proposedMove)) { this.playerPiece = proposedMove; this.draw(); }
        }
        moveRight() {
            if(isPaused || !this.playerPiece) return;
            let proposedMove = { ...this.playerPiece, x: this.playerPiece.x + 1 };
            if (this.isValidMove(proposedMove)) { this.playerPiece = proposedMove; this.draw(); }
        }
        rotatePiece() {
            if(isPaused || !this.playerPiece) return;
            if (this.playerPiece.type === 'O') return;
            let proposedMove = { ...this.playerPiece, shape: this.rotate(this.playerPiece.shape) };
            const kicks = [0, 1, -1, 2, -2];
            for (const kick of kicks) {
                const kickedMove = { ...proposedMove, x: proposedMove.x + kick };
                if (this.isValidMove(kickedMove)) {
                    this.playerPiece = kickedMove;
                    this.draw();
                    return;
                }
            }
        }
        rotate(matrix) {
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
            if(isPaused || !this.playerPiece) return;
            let futureMove = { ...this.playerPiece, y: this.playerPiece.y + 1 };
            if (this.isValidMove(futureMove)) {
                this.playerPiece.y++;
                this.draw();
            } else {
                this.lockPiece();
                this.processGarbage();
                this.spawnNewPiece();
                this.draw();
            }
        }
        update() { if (!isPaused) { this.draw(); } }
        start() {
            this.board = this.createEmptyBoard();
            this.score = 0;
            this.scoreElement.textContent = '0';
            this.gameSpeed = LEVEL_START_SPEED;
            this.garbageQueue = 0;
            this.totalLinesCleared = 0;
            this.bag = [];
            if (currentGameMode === 'single') {
                 p1GoalLines.textContent = `0`;
            }
            this.spawnNewPiece();
            this.lastDropTime = 0; // [!修改!] 重置掉落計時器
        }
        autoDrop(timestamp) {
            if (isPaused) return;
            if (!this.lastDropTime) this.lastDropTime = timestamp;
            const deltaTime = timestamp - this.lastDropTime;
            if (deltaTime > this.gameSpeed) {
                this.lastDropTime = timestamp;
                this.drop();
            }
        }
    }
    // --- 玩家 Class (類別) 結束 ---

    // --- 3. 遊戲啟動與控制 (含選單邏輯) ---
    // (DOM 元素取得 v6.0)
    const mainMenu = document.getElementById('main-menu');
    const gameArea = document.getElementById('game-area');
    const gameWonMenu = document.getElementById('game-won');
    const winMessage = document.getElementById('win-message');
    const btnSinglePlayer = document.getElementById('btn-single-player');
    const btnTwoPlayer = document.getElementById('btn-two-player');
    const btnBackToMenu = document.getElementById('btn-back-to-menu');
    const player1Zone = document.getElementById('player1-zone');
    const player2Zone = document.getElementById('player2-zone');
    const p1Instructions = document.getElementById('instructions-p1');
    const p2Instructions = document.getElementById('instructions-p2');
    const p1GoalDisplay = document.getElementById('p1-goal-display');
    const p1GoalLines = document.getElementById('p1-goal-lines');
    const btnPause = document.getElementById('btn-pause');
    const btnRestart = document.getElementById('btn-restart'); 
    const btnRestartMatch = document.getElementById('btn-restart-match'); 
    const mobileControls = document.getElementById('mobile-controls');
    const btnMobileLeft = document.getElementById('btn-mobile-left');
    const btnMobileRight = document.getElementById('btn-mobile-right');
    const btnMobileRotate = document.getElementById('btn-mobile-rotate');
    const btnMobileDown = document.getElementById('btn-mobile-down');
    
    // [!修改!] 裝置偵測後，更新 UI
    if (isMobile) {
        btnTwoPlayer.classList.add('hidden'); // 手機版隱藏雙人
    }
    
    // (gameLoop, startGame, showMenu, restartGame, showGameWonScreen, togglePause v6.0)
    function gameLoop(timestamp) {
        allPlayers.forEach(player => {
            player.autoDrop(timestamp);
            player.update();
        });
        if (!isPaused) { globalGameInterval = requestAnimationFrame(gameLoop); }
    }
    function startGame(mode) {
        currentGameMode = mode || currentGameMode; 
        mainMenu.classList.add('hidden');
        gameArea.classList.remove('hidden');
        btnRestartMatch.classList.remove('hidden');
        gameWonMenu.classList.add('hidden');
        
        if (isMobile) {
            mobileControls.classList.remove('hidden');
            player1Zone.style.margin = "0 auto";
        }
        
        allPlayers = [];
        const player1 = new Player('p1-board', 'p1-score');
        allPlayers.push(player1);
        
        p1GoalDisplay.classList.add('hidden');

        if (currentGameMode === 'single') {
            player2Zone.classList.add('hidden');
            p1Instructions.classList.remove('hidden');
            p2Instructions.classList.add('hidden');
            p1GoalDisplay.classList.remove('hidden');
        } 
        else if (currentGameMode === 'two') {
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
        if (fireworksLoopId) { cancelAnimationFrame(fireworksLoopId); }
        
        globalGameInterval = null;
        fireworksLoopId = null;
        allPlayers = [];
        
        mainMenu.classList.remove('hidden');
        gameArea.classList.add('hidden');
        gameWonMenu.classList.add('hidden');
        btnRestartMatch.classList.add('hidden');
        mobileControls.classList.add('hidden');
        
        currentGameMode = null;
        
        const p1Ctx = document.getElementById('p1-board').getContext('2d');
        const p2Ctx = document.getElementById('p2-board').getContext('2d');
        p1Ctx.fillStyle = 'black'; p1Ctx.fillRect(0, 0, p1Ctx.canvas.width, p1Ctx.canvas.height);
        p2Ctx.fillStyle = 'black'; p2Ctx.fillRect(0, 0, p2Ctx.canvas.width, p2Ctx.canvas.height);
    }
    function restartGame() {
        if (currentGameMode) {
            allPlayers.forEach(player => {
                if (player.gameInterval) { clearInterval(player.gameInterval); }
            });
            if (globalGameInterval) { cancelAnimationFrame(globalGameInterval); }
            globalGameInterval = null;
            startGame(currentGameMode);
        }
    }
    function showGameWonScreen(winningPlayer) {
        gameArea.classList.add('hidden');
        gameWonMenu.classList.remove('hidden');
        mobileControls.classList.add('hidden');
        
        if (winningPlayer.opponent) {
            const winnerId = winningPlayer.canvas.id.replace('-board', '').toUpperCase();
            winMessage.textContent = `${winnerId} 獲勝！`;
        } else {
            winMessage.textContent = '你完成了 100 行挑戰！';
        }
        startFireworks(winningPlayer.context);
    }
    function togglePause() {
        if (!allPlayers.length || fireworksLoopId) return;
        isPaused = !isPaused;
        if (isPaused) {
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
                player.lastDropTime = 0; 
            });
            btnPause.textContent = "P (暫停)";
            requestAnimationFrame(gameLoop);
        }
    }

    // 鍵盤控制 (v6.0 不變)
    document.addEventListener('keydown', (event) => {
        if (event.key === 'p' || event.key === 'P') { togglePause(); return; }
        if (isPaused || !allPlayers.length) return; 
        if (allPlayers[0] && allPlayers[0].playerPiece) { 
            if (event.key === 'ArrowLeft') { allPlayers[0].moveLeft(); }
            else if (event.key === 'ArrowRight') { allPlayers[0].moveRight(); }
            else if (event.key === 'ArrowDown') { allPlayers[0].drop(); }
            else if (event.key === 'ArrowUp') { allPlayers[0].rotatePiece(); }
        }
        if (allPlayers[1] && allPlayers[1].playerPiece) { 
            if (event.key === 'a' || event.key === 'A') { allPlayers[1].moveLeft(); }
            else if (event.key === 'd' || event.key === 'D') { allPlayers[1].moveRight(); }
            else if (event.key === 's' || event.key === 'S') { allPlayers[1].drop(); }
            else if (event.key === 'w' || event.key === 'W') { allPlayers[1].rotatePiece(); }
        }
    });

    // 電腦 + 手機按鈕監聽 (v6.0)
    btnSinglePlayer.addEventListener('click', () => startGame('single'));
    btnTwoPlayer.addEventListener('click', () => startGame('two'));
    btnBackToMenu.addEventListener('click', showMenu);
    btnPause.addEventListener('click', togglePause);
    btnRestart.addEventListener('click', showMenu);
    btnRestartMatch.addEventListener('click', restartGame);
    btnMobileLeft.addEventListener('click', () => { if (allPlayers[0]) allPlayers[0].moveLeft(); });
    btnMobileRight.addEventListener('click', () => { if (allPlayers[0]) allPlayers[0].moveRight(); });
    btnMobileDown.addEventListener('click', () => { if (allPlayers[0]) allPlayers[0].drop(); });
    btnMobileRotate.addEventListener('click', () => { if (allPlayers[0]) allPlayers[0].rotatePiece(); });

    
    // --- 4. 煙火特效 (v5.0 不變) ---
    // (這整段 4.x 函式和 class 都不變)
    let fireworks = [];
    let fireworksContext = null;
    function startFireworks(context) {
        fireworksContext = context;
        fireworks = []; 
        if(globalGameInterval) cancelAnimationFrame(globalGameInterval);
        globalGameInterval = null;
        allPlayers.forEach(p => clearInterval(p.gameInterval)); // 確保舊 setInterval 也停了
        for (let i = 0; i < 5; i++) {
            fireworks.push(new Firework(
                Math.random() * (COLS * BLOCK_SIZE), ROWS * BLOCK_SIZE, 
                Math.random() * (COLS * BLOCK_SIZE * 0.4) + (COLS * BLOCK_SIZE * 0.3),
                Math.random() * (ROWS * BLOCK_SIZE * 0.5)
            ));
        }
        if(fireworksLoopId) cancelAnimationFrame(fireworksLoopId);
        fireworksLoopId = requestAnimationFrame(fireworksLoop);
    }
    function fireworksLoop() {
        if (!fireworksContext || !fireworksLoopId) {
             if(fireworksLoopId) cancelAnimationFrame(fireworksLoopId);
             fireworksLoopId = null; return;
        }
        fireworksContext.fillStyle = 'rgba(0, 0, 0, 0.1)';
        fireworksContext.fillRect(0, 0, fireworksContext.canvas.width, fireworksContext.canvas.height);
        for (let i = fireworks.length - 1; i >= 0; i--) {
            fireworks[i].update();
            fireworks[i].draw(fireworksContext);
            if (fireworks[i].isDead()) {
                fireworks.splice(i, 1);
                fireworks.push(new Firework(
                    Math.random() * (COLS * BLOCK_SIZE), ROWS * BLOCK_SIZE, 
                    Math.random() * (COLS * BLOCK_SIZE * 0.4) + (COLS * BLOCK_SIZE * 0.3),
                    Math.random() * (ROWS * BLOCK_SIZE * 0.5)
                ));
            }
        }
        fireworksLoopId = requestAnimationFrame(fireworksLoop);
    }
    class Firework {
        constructor(x, y, targetX, targetY) {
            this.x = x; this.y = y;
            this.targetX = targetX; this.targetY = targetY;
            this.speed = 3;
            this.angle = Math.atan2(targetY - y, targetX - x);
            this.vx = Math.cos(this.angle) * this.speed;
            this.vy = Math.sin(this.angle) * this.speed;
            this.particles = [];
            this.exploded = false;
        }
        update() {
            if (!this.exploded) {
                this.x += this.vx; this.y += this.vy;
                if (this.y <= this.targetY) { this.explode(); }
            } else {
                for (let i = this.particles.length - 1; i >= 0; i--) {
                    this.particles[i].update();
                    if (this.particles[i].isDead()) { this.particles.splice(i, 1); }
                }
            }
        }
        draw(ctx) {
            if (!this.exploded) {
                ctx.fillStyle = '#FFFF00';
                ctx.fillRect(this.x, this.y, 3, 3);
            } else {
                this.particles.forEach(p => p.draw(ctx));
            }
        }
        explode() {
            this.exploded = true;
            const color = `hsl(${Math.random() * 360}, 100%, 50%)`;
            for (let i = 0; i < 30; i++) {
                this.particles.push(new Particle(this.x, this.y, color));
            }
        }
        isDead() { return this.exploded && this.particles.length === 0; }
    }
    class Particle {
        constructor(x, y, color) {
            this.x = x; this.y = y; this.color = color;
            this.speed = Math.random() * 2 + 1;
            this.angle = Math.random() * Math.PI * 2;
            this.vx = Math.cos(this.angle) * this.speed;
            this.vy = Math.sin(this.angle) * this.speed;
            this.gravity = 0.05;
            this.alpha = 1.0;
        }
        update() {
            this.x += this.vx; this.y += this.vy;
            this.vy += this.gravity;
            this.alpha -= 0.01;
        }
        draw(ctx) {
            ctx.globalAlpha = this.alpha;
            ctx.fillStyle = this.color;
            ctx.fillRect(this.x, this.y, 2, 2);
            ctx.globalAlpha = 1.0;
        }
        isDead() { return this.alpha <= 0; }
    }
});
