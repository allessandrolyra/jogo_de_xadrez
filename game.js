/**
 * Chess Online - Studio de IA
 * Core Game Logic & UI Orchestration
 */

const game = new Chess();
let board = null;
let currentMode = 'pvai'; // 'pvai' or 'pvp'
let aiLevel = 10;
let stockfish = null;
let peer = null;
let conn = null;
let playerColor = 'w';
let scores = { w: 0, b: 0 };

// Elementos da UI - Menu
const menuOverlay = document.getElementById('menu-overlay');
const btnPvP = document.getElementById('btn-pvp');
const btnPvAI = document.getElementById('btn-pvai');
const setupPvAI = document.getElementById('setup-pvai');
const setupPvP = document.getElementById('setup-pvp');
const startGameBtn = document.getElementById('start-game');
const myIdEl = document.getElementById('my-id');
const peerIdInput = document.getElementById('peer-id');
const connectBtn = document.getElementById('btn-connect');

// Elementos da UI - Jogo
const boardEl = document.getElementById('board');
const moveHistoryEl = document.getElementById('move-history');
const displayWhite = document.getElementById('display-white');
const displayBlack = document.getElementById('display-black');
const scoreWhiteEl = document.getElementById('score-white');
const scoreBlackEl = document.getElementById('score-black');

// Botões de Controle
const resetMatchBtn = document.getElementById('reset-match');
const resetGameBtn = document.getElementById('reset-game');
const closeGameBtn = document.getElementById('close-game');

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    initMenu();
    initBoard();
    initStockfish();
    initPeer();
    
    // Configuração do histórico retrátil
    document.getElementById('toggle-history').addEventListener('click', () => {
        document.getElementById('game-sidebar').classList.toggle('collapsed');
    });
});

function initMenu() {
    // Seleção de Modo
    btnPvP.addEventListener('click', () => {
        currentMode = 'pvp';
        btnPvP.classList.add('active');
        btnPvAI.classList.remove('active');
        setupPvAI.classList.add('hidden');
        setupPvP.classList.remove('hidden');
        // Limpa nomes para preenchimento manual no PvP
        document.getElementById('player-white').value = "";
        document.getElementById('player-black').value = "";
        document.getElementById('player-black').placeholder = "Nome do Amigo";
    });

    btnPvAI.addEventListener('click', () => {
        currentMode = 'pvai';
        btnPvAI.classList.add('active');
        btnPvP.classList.remove('active');
        setupPvAI.classList.remove('hidden');
        setupPvP.classList.add('hidden');
        // Preenche nomes padrão para o modo I.A.
        document.getElementById('player-white').value = "Mestre_Alessandro";
        document.getElementById('player-black').value = "Deep_BMAD";
    });

    // Dificuldade I.A.
    document.querySelectorAll('.diff-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            aiLevel = parseInt(e.target.dataset.level);
        });
    });

    // Iniciar Partida
    startGameBtn.addEventListener('click', () => {
        const whiteName = document.getElementById('player-white').value;
        const blackName = document.getElementById('player-black').value;
        
        displayWhite.innerText = whiteName;
        displayBlack.innerText = blackName;
        
        closeMenu();
        startNewPartida();
    });

    // Conectar P2P
    connectBtn.addEventListener('click', () => {
        const id = peerIdInput.value;
        if (id) {
            conn = peer.connect(id);
            playerColor = 'b';
            board.orientation('black');
            setupConnection();
            closeMenu();
            startNewPartida();
        }
    });

    // Controles de Jogo
    resetMatchBtn.addEventListener('click', startNewPartida);
    resetGameBtn.addEventListener('click', () => {
        localStorage.removeItem('chess-scores');
        location.reload();
    });
    closeGameBtn.addEventListener('click', () => {
        location.reload();
    });

    // Tutorial
    const tutorialModal = document.getElementById('tutorial-modal');
    document.getElementById('btn-help').addEventListener('click', () => {
        tutorialModal.classList.remove('hidden');
    });
    document.getElementById('close-tutorial').addEventListener('click', () => {
        tutorialModal.classList.add('hidden');
    });

    // Fim de Jogo
    document.getElementById('restart-after-mate').addEventListener('click', () => {
        document.getElementById('game-over-modal').classList.add('hidden');
        startNewPartida();
    });
}

function showToast(message) {
    const container = document.getElementById('notification-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerText = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function closeMenu() {
    menuOverlay.style.opacity = '0';
    setTimeout(() => menuOverlay.style.display = 'none', 500);
}

function startNewPartida() {
    game.reset();
    board.start();
    updateStatus();
    updateHistory();
}

function initBoard() {
    const config = {
        draggable: true,
        position: 'start',
        onDragStart: onDragStart,
        onDrop: onDrop,
        onSnapEnd: onSnapEnd,
        pieceTheme: 'https://raw.githubusercontent.com/oakmac/chessboardjs/master/website/img/chesspieces/wikipedia/{piece}.png'
    };
    board = Chessboard('board', config);
    
    // Suporte a redimensionamento automático
    window.addEventListener('resize', () => {
        board.resize();
    });
}

function initStockfish() {
    try {
        stockfish = new Worker('assets/stockfish.js');
        stockfish.onmessage = (event) => {
            const line = event.data;
            if (line.includes('bestmove')) {
                const moveParts = line.split(' ');
                const bestMove = moveParts[1];
                makeEngineMove(bestMove);
            }
        };
        stockfish.postMessage('uci');
    } catch (e) {
        console.error('Falha ao carregar Stockfish:', e);
    }
}

function initPeer() {
    peer = new Peer();
    peer.on('open', (id) => {
        if(myIdEl) myIdEl.innerText = id;
    });

    peer.on('connection', (c) => {
        conn = c;
        setupConnection();
        playerColor = 'w';
        board.orientation('white');
        closeMenu();
        startNewPartida();
    });
}

function setupConnection() {
    // Função para enviar o nome local
    const sendMyName = () => {
        const localName = (playerColor === 'w') ? 
            document.getElementById('player-white').value || "Mestre" : 
            document.getElementById('player-black').value || "Desafiante";
        
        console.log("Enviando nome local:", localName);
        conn.send({ type: 'init', name: localName });
    };

    // Se já estiver aberta, envia logo. Se não, espera o evento 'open'
    if (conn.open) {
        sendMyName();
    } else {
        conn.on('open', sendMyName);
    }

    conn.on('data', (data) => {
        if (data.type === 'init') {
            console.log("Recebido nome do oponente:", data.name);
            if (playerColor === 'w') {
                // Eu sou Brancas, oponente é Pretas
                displayBlack.innerText = data.name;
            } else {
                // Eu sou Pretas, oponente é Brancas
                displayWhite.innerText = data.name;
            }
        }
        if (data.type === 'move') {
            game.move(data.move);
            board.position(game.fen());
            updateStatus();
        }
    });

    conn.on('close', () => {
        showToast("⚠️ Conexão perdida com o oponente.");
    });
}

function onDragStart(source, piece, position, orientation) {
    if (game.game_over()) return false;
    
    if (currentMode === 'pvp') {
        if ((playerColor === 'w' && piece.search(/^b/) !== -1) ||
            (playerColor === 'b' && piece.search(/^w/) !== -1)) {
            return false;
        }
    }

    if ((game.turn() === 'w' && piece.search(/^b/) !== -1) ||
        (game.turn() === 'b' && piece.search(/^w/) !== -1)) {
        return false;
    }
}

function onDrop(source, target) {
    // Tenta validar o movimento
    const move = game.move({
        from: source,
        to: target,
        promotion: 'q'
    });

    // Se o movimento for ilegal
    if (move === null) {
        explainIllegalMove(source, target);
        return 'snapback';
    }
    
    updateStatus();

    if (currentMode === 'pvp' && conn) {
        conn.send({ type: 'move', move: move });
    }
    
    if (currentMode === 'pvai' && !game.game_over()) {
        window.setTimeout(askStockfish, 250);
    }
}

function explainIllegalMove(source, target) {
    const piece = game.get(source);
    
    // 1. Verificar se o Rei está em xeque e o movimento não resolve
    if (game.in_check()) {
        showToast("⚠️ Movimento Inválido: Seu Rei está em Xeque! Você deve protegê-lo.");
        return;
    }

    // 2. Verificar se o movimento deixaria o próprio Rei em xeque
    const tempGame = new Chess(game.fen());
    const moves = tempGame.moves({ square: source });
    if (moves.length === 0) {
        showToast("⚠️ Movimento Bloqueado: Esta peça está protegendo seu Rei.");
        return;
    }

    // 3. Regras específicas por peça (Simples)
    if (piece.type === 'p') {
        showToast("⚠️ Peões só andam para frente ou capturam na diagonal.");
    } else if (piece.type === 'n') {
        showToast("⚠️ Cavalos devem se mover em formato de 'L'.");
    } else {
        showToast("⚠️ Movimento ilegal para esta peça ou caminho obstruído.");
    }
}

function onSnapEnd() {
    board.position(game.fen());
}

function askStockfish() {
    if (!stockfish) return;
    stockfish.postMessage(`setoption name Skill Level value ${aiLevel}`);
    stockfish.postMessage(`position fen ${game.fen()}`);
    stockfish.postMessage('go depth 10');
}

function makeEngineMove(bestMove) {
    game.move({
        from: bestMove.substring(0, 2),
        to: bestMove.substring(2, 4),
        promotion: 'q'
    });
    board.position(game.fen());
    updateStatus();
}

function updateStatus() {
    if (game.in_checkmate()) {
        const winner = game.turn() === 'w' ? 'b' : 'w';
        scores[winner]++;
        updateScoreboard();
        // Tempo para o jogador ver a jogada vencedora
        setTimeout(() => showGameOver(winner), 3000);
    } else if (game.in_draw() || game.in_stalemate() || game.in_threefold_repetition()) {
        setTimeout(() => showGameOver('draw'), 3000);
    } else {
        // Assistente de Xeque no modo Fácil (aiLevel === 0)
        // Apenas para o jogador humano (Brancas por padrão ou se orientation for white)
        const isPlayerTurn = (board.orientation() === 'white' && game.turn() === 'w') || 
                            (board.orientation() === 'black' && game.turn() === 'b');
        
        if (aiLevel === 0 && game.in_check() && isPlayerTurn) {
            suggestMoveOutOfCheck();
        }
    }
    updateHistory();
}

function suggestMoveOutOfCheck() {
    const moves = game.moves({ verbose: true });
    if (moves.length > 0) {
        // Prioriza movimentos de Rei ou capturas se possível, mas aqui pegamos o primeiro válido
        const suggestion = moves[0]; 
        const pieceNames = {
            'p': 'Peão', 'r': 'Torre', 'n': 'Cavalo', 
            'b': 'Bispo', 'q': 'Rainha', 'k': 'Rei'
        };
        const piece = pieceNames[suggestion.piece] || 'peça';
        showToast(`💡 ASSISTENTE: Você está em Xeque! Sugestão: Mova seu ${piece} para ${suggestion.to.toUpperCase()}.`);
    }
}

function showGameOver(winner) {
    const modal = document.getElementById('game-over-modal');
    const title = document.getElementById('game-over-title');
    const nameEl = document.getElementById('winner-name');
    const msg = document.getElementById('game-over-msg');
    
    modal.classList.remove('hidden');
    
    if (winner === 'draw') {
        title.innerText = "EMPATE!";
        msg.innerText = "A partida terminou em empate por falta de movimentos válidos ou repetição.";
        nameEl.parentElement.style.display = 'none';
    } else {
        const whiteName = document.getElementById('display-white').innerText;
        const blackName = document.getElementById('display-black').innerText;
        const winnerName = winner === 'w' ? whiteName : blackName;
        
        title.innerText = "XEQUE-MATE!";
        msg.innerText = "O Rei foi encurralado! Vitória absoluta.";
        nameEl.innerText = winnerName;
        nameEl.parentElement.style.display = 'block';
    }
}

function updateScoreboard() {
    if(scoreWhiteEl) scoreWhiteEl.innerText = scores.w;
    if(scoreBlackEl) scoreBlackEl.innerText = scores.b;
}

function updateHistory() {
    const history = game.history({ verbose: true });
    const whiteName = displayWhite.innerText || 'Jogador Brancas';
    const blackName = displayBlack.innerText || 'Jogador Pretas';

    moveHistoryEl.innerHTML = history.map((m, i) => {
        const playerName = m.color === 'w' ? whiteName : blackName;
        const pieceNames = {
            'p': 'Peão', 'r': 'Torre', 'n': 'Cavalo', 
            'b': 'Bispo', 'q': 'Rainha', 'k': 'Rei'
        };
        const piece = pieceNames[m.piece] || '';
        const description = `${playerName} movimentou ${piece} para ${m.to.toUpperCase()}`;
        
        return `
            <div class="move-item">
                <span class="move-meta">Jogada ${i + 1}</span>
                <span class="move-desc">${description}</span>
            </div>
        `;
    }).join('');
    moveHistoryEl.scrollTop = moveHistoryEl.scrollHeight;
}
