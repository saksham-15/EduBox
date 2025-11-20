// --- CONFIGURATION ---
const API_URL = 'https://edubox-0d1v.onrender.com';
const TOTAL_QUESTIONS_COUNT = 10; // <--- FIX: Score will now show /10

// Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyDQAlI0D1qBkaHcqSO-xIbkXbncxQTSHd4",
  authDomain: "edubox-6918.firebaseapp.com",
  projectId: "edubox-6918",
  storageBucket: "edubox-6918.firebasestorage.app",
  messagingSenderId: "457758932957",
  appId: "1:457758932957:web:792b61c58c6396128d8034",
  measurementId: "G-W2LP8BP1VQ"
};

// --- STATE ---
let currentQuestionId = null;
let currentOptions = []; 
let quizScore = 0;
let userId = null;
let username = null;

document.addEventListener('DOMContentLoaded', () => {
    const authScreen = document.getElementById('auth-screen');
    const mainApp = document.getElementById('main-app');
    const chatWindow = document.getElementById('chat-window');
    const chatInput = document.getElementById('chat-input');
    const sendButton = document.getElementById('send-btn');
    const userDisplay = document.getElementById('user-display');
    const leaderboardList = document.getElementById('leaderboard-list');
    const authErrors = document.getElementById('auth-errors');
    
    // Auth Buttons
    const usernameInput = document.getElementById('username-input');
    const passwordInput = document.getElementById('password-input');
    const loginBtn = document.getElementById('login-btn');
    const signupBtn = document.getElementById('signup-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const anonymousBtn = document.getElementById('anonymous-btn');

    const app = firebase.initializeApp(firebaseConfig);
    const auth = firebase.auth();

    // --- AUTH LISTENERS ---
    loginBtn.addEventListener('click', () => handleAuth('login'));
    signupBtn.addEventListener('click', () => handleAuth('signup'));
    anonymousBtn.addEventListener('click', () => auth.signInAnonymously().catch(e => displayAuthError(e.message)));
    logoutBtn.addEventListener('click', () => auth.signOut());

    // --- AUTH HANDLER ---
    async function handleAuth(type) {
        const name = usernameInput.value.trim();
        const pass = passwordInput.value.trim();
        const email = name + "@edubox.com";
        try {
            if (!name) throw new Error("Username required");
            if (type === 'signup') {
                if (pass.length < 6) throw new Error("Password must be 6+ chars");
                const cred = await auth.createUserWithEmailAndPassword(email, pass);
                await cred.user.updateProfile({ displayName: name });
                username = name;
                userDisplay.textContent = `User: ${username}`;
                chatWindow.innerHTML = ''; 
                addMessageToChat(`<strong>Welcome ${username}!</strong><br>Type 'quiz' to start.`, 'bot');
                fetchLeaderboard();
            } else {
                await auth.signInWithEmailAndPassword(email, pass);
            }
        } catch (e) { displayAuthError(e.message); }
    }

    function displayAuthError(msg) {
        authErrors.textContent = msg;
        authErrors.classList.remove('d-none');
        setTimeout(() => authErrors.classList.add('d-none'), 5000);
    }

    auth.onAuthStateChanged((user) => {
        if (user) {
            userId = user.uid;
            if (!username || username === 'Anonymous') {
                username = user.displayName || 'Anonymous';
            }
            userDisplay.textContent = `User: ${username}`;
            authScreen.style.display = 'none';
            mainApp.style.display = 'flex';
            if (chatWindow.innerHTML === "") {
                 fetchLeaderboard();
                 addMessageToChat(`<strong>Welcome ${username}!</strong><br>Type 'quiz' to start.`, 'bot');
            }
        } else {
            userId = null;
            username = null;
            authScreen.style.display = 'flex';
            mainApp.style.display = 'none';
            chatWindow.innerHTML = ''; 
        }
    });

    // --- CHAT & QUIZ ENGINE ---
    sendButton.addEventListener('click', sendMessage);
    chatInput.addEventListener('keyup', (e) => { if (e.key === 'Enter') sendMessage(); });

    async function sendMessage() {
        if (!userId) return;
        const text = chatInput.value.trim();
        if (!text) return;

        addMessageToChat(text, 'user');
        chatInput.value = '';

        if (currentQuestionId) {
            // Handle Manual Typing (A, B, C, D)
            const lowerText = text.toLowerCase();
            if (lowerText.length === 1 && ['a','b','c','d'].includes(lowerText)) {
                const map = {'a': 0, 'b': 1, 'c': 2, 'd': 3};
                const index = map[lowerText];
                if (currentOptions && currentOptions[index]) {
                    await submitQuizAnswer(currentOptions[index]);
                } else {
                    await submitQuizAnswer(text);
                }
            } else {
                await submitQuizAnswer(text);
            }
        } else {
            await sendChatMessage(text);
        }
    }

    async function sendChatMessage(message) {
        try {
            const res = await fetch(`${API_URL}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message })
            });
            const data = await res.json();
            addMessageToChat(data.reply, 'bot');

            const reply = data.reply.toLowerCase();
            if (reply.includes("first question") || reply.includes("question 1")) {
                quizScore = 0;
                await getQuizQuestion('q1');
            }
        } catch (e) {
            addMessageToChat("Backend error. Check console.", 'bot');
        }
    }

    async function getQuizQuestion(qid) {
        try {
            const res = await fetch(`${API_URL}/quiz/${qid}`);
            const data = await res.json();

            if (data.error) { return addMessageToChat(data.error, 'bot'); }

            currentQuestionId = data.id;
            currentOptions = data.options; 
            
            addMessageToChat(`<strong>Question:</strong> ${data.question}`, 'bot');

            if (data.options && data.options.length > 0) {
                const wrapper = document.createElement('div');
                wrapper.className = 'options-container'; 
                
                const btnContainer = document.createElement('div');
                btnContainer.className = 'd-grid gap-2'; 

                const letters = ['A', 'B', 'C', 'D'];
                data.options.forEach((opt, i) => {
                    if (i > 3) return;
                    const btn = document.createElement('button');
                    btn.className = 'btn btn-outline-light text-start border-secondary text-light'; 
                    btn.innerText = `${letters[i]}) ${opt}`;
                    
                    btn.onclick = function() {
                        Array.from(btnContainer.children).forEach(b => {
                            b.disabled = true; 
                            b.classList.add('opacity-50');
                        });
                        this.classList.remove('opacity-50', 'btn-outline-light');
                        this.classList.add('btn-primary', 'text-white');
                        
                        submitQuizAnswer(opt); 
                    };
                    btnContainer.appendChild(btn);
                });
                wrapper.appendChild(btnContainer);
                chatWindow.appendChild(wrapper);
                chatWindow.scrollTop = chatWindow.scrollHeight;
            } 
        } catch (e) {
            console.error("Error getting question:", e);
        }
    }

    async function submitQuizAnswer(ans) {
        try {
            const res = await fetch(`${API_URL}/submit_answer`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question_id: currentQuestionId, user_answer: ans })
            });
            const data = await res.json();
            
            let feedbackColor = data.correct ? 'text-success' : 'text-danger';
            addMessageToChat(`<span class="${feedbackColor}"><strong>${data.feedback}</strong></span>`, 'bot');

            if (data.correct) {
                quizScore++;
                const nextNum = parseInt(currentQuestionId.replace('q','')) + 1;
                if (nextNum > 10) {
                    endQuiz();
                } else {
                    setTimeout(() => getQuizQuestion('q' + nextNum), 1500);
                }
            } else {
                // Sudden Death: End quiz on wrong answer
                endQuiz();
            }
        } catch (e) { console.error(e); }
    }

    // --- FIXED: Score Display Logic ---
    async function endQuiz() {
        currentQuestionId = null;
        // Shows Score / 10
        addMessageToChat(`🏁 <strong>Quiz Finished!</strong> Score: ${quizScore}/${TOTAL_QUESTIONS_COUNT}`, 'bot');
        await submitFinalScore(quizScore, TOTAL_QUESTIONS_COUNT);
    }

    async function submitFinalScore(s, t) {
        if (!userId || !username || username === 'Anonymous' || username.includes('Anonymous')) {
            addMessageToChat("Sign in to save your score to the leaderboard!", 'bot');
            return;
        }
        
        try {
            await fetch(`${API_URL}/score`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, username, score: s, total: t })
            });
            fetchLeaderboard(); 
        } catch (e) { console.error(e); }
    }

    async function fetchLeaderboard() {
        try {
            const res = await fetch(`${API_URL}/leaderboard`);
            
            // Error Handling: If backend is old, it might return 404 or 500
            if (!res.ok) throw new Error("Server not updated");

            const scores = await res.json();
            leaderboardList.innerHTML = '';
            
            if (scores.length === 0) {
                leaderboardList.innerHTML = '<li class="list-group-item bg-dark text-muted">No scores yet.</li>';
                return;
            }

            scores.forEach((s, i) => {
                const li = document.createElement('li');
                li.className = 'list-group-item bg-dark d-flex justify-content-between text-light border-secondary';
                let icon = i===0?'🥇':i===1?'🥈':i===2?'🥉':'•';
                li.innerHTML = `<div>${icon} ${s.username}</div><span class="badge bg-primary rounded-pill">${s.score}/${s.total}</span>`;
                leaderboardList.appendChild(li);
            });
        } catch (e) { 
            console.error("Leaderboard error", e);
            leaderboardList.innerHTML = '<li class="list-group-item bg-dark text-danger">Server update required</li>';
        }
    }

    function addMessageToChat(msg, sender) {
        const div = document.createElement('div');
        div.classList.add('message', sender);
        div.innerHTML = msg;
        chatWindow.appendChild(div);
        chatWindow.scrollTop = chatWindow.scrollHeight;
    }
});
