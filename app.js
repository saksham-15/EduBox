// --- CONFIGURATION ---
const API_URL = 'https://edubox-0d1v.onrender.com';

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
let quizScore = 0;
let totalQuestions = 0;
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

    // Initialize Firebase
    const app = firebase.initializeApp(firebaseConfig);
    const auth = firebase.auth();

    // --- AUTH LISTENERS ---
    loginBtn.addEventListener('click', () => handleAuth('login'));
    signupBtn.addEventListener('click', () => handleAuth('signup'));
    anonymousBtn.addEventListener('click', () => auth.signInAnonymously().catch(e => displayAuthError(e.message)));
    logoutBtn.addEventListener('click', () => auth.signOut());

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
            username = user.displayName || 'Anonymous';
            userDisplay.textContent = `User: ${username}`;
            authScreen.style.display = 'none';
            mainApp.style.display = 'flex';
            fetchLeaderboard();
            addMessageToChat(`<strong>Welcome ${username}!</strong><br>Type 'quiz' to start.`, 'bot');
        } else {
            userId = null;
            authScreen.style.display = 'flex';
            mainApp.style.display = 'none';
        }
    });

    // --- CHAT LOGIC ---
    sendButton.addEventListener('click', sendMessage);
    chatInput.addEventListener('keyup', (e) => { if (e.key === 'Enter') sendMessage(); });

    async function sendMessage() {
        if (!userId) return;
        const text = chatInput.value.trim();
        if (!text) return;

        addMessageToChat(text, 'user');
        chatInput.value = '';

        // If currently in a quiz, any text is an answer (fallback)
        if (currentQuestionId) {
            await submitQuizAnswer(text);
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

            // --- FIXED TRIGGER LOGIC ---
            // Check if the bot is starting a quiz. We check for keywords.
            const reply = data.reply.toLowerCase();
            if (reply.includes("first question") || reply.includes("question 1")) {
                console.log("Quiz Trigger Detected!"); // Check your console for this
                quizScore = 0;
                totalQuestions = 0;
                await getQuizQuestion('q1');
            }
        } catch (e) {
            addMessageToChat("Backend error. Check console.", 'bot');
        }
    }

    // DELETE the old getQuizQuestion function and PASTE this one:

async function getQuizQuestion(qid) {
    console.log(`Fetching question: ${qid}`);
    try {
        const res = await fetch(`${API_URL}/quiz/${qid}`);
        const data = await res.json();

        if (data.error) { return addMessageToChat(data.error, 'bot'); }

        currentQuestionId = data.id;
        
        // 1. Show the question text
        addMessageToChat(`<strong>Question:</strong> ${data.question}`, 'bot');

        // 2. Render the Buttons
        if (data.options && data.options.length > 0) {
            const wrapper = document.createElement('div');
            wrapper.className = 'options-container'; 
            
            const btnContainer = document.createElement('div');
            btnContainer.className = 'd-grid gap-2'; 

            const letters = ['A', 'B', 'C', 'D'];
            
            data.options.forEach((opt, i) => {
                if (i > 3) return;
                const btn = document.createElement('button');
                // Standard white outline style
                btn.className = 'btn btn-outline-light text-start border-secondary text-light'; 
                btn.innerText = `${letters[i]}) ${opt}`;
                
                btn.onclick = function() {
                    // Disable others
                    Array.from(btnContainer.children).forEach(b => {
                        b.disabled = true; 
                        b.classList.add('opacity-50');
                    });
                    
                    // Highlight Selected
                    this.classList.remove('opacity-50', 'btn-outline-light');
                    this.classList.add('btn-primary', 'text-white');
                    
                    // --------------- CRITICAL FIX ---------------
                    // We send 'opt' (e.g., "DynamoDB"), NOT letters[i] (e.g., "B")
                    submitQuizAnswer(opt); 
                    // --------------------------------------------
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
        totalQuestions++;
        try {
            const res = await fetch(`${API_URL}/submit_answer`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question_id: currentQuestionId, user_answer: ans })
            });
            const data = await res.json();
            
            // Show feedback
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
            } else if (data.feedback.includes("over")) {
                endQuiz();
            } else if (data.feedback.includes("Invalid")) {
                totalQuestions--; // Don't count invalid inputs
            }
        } catch (e) { console.error(e); }
    }

    async function endQuiz() {
        currentQuestionId = null;
        addMessageToChat(`🏁 <strong>Quiz Finished!</strong> Score: ${quizScore}/${totalQuestions}`, 'bot');
        await submitFinalScore(quizScore, totalQuestions);
    }

    async function submitFinalScore(s, t) {
        if (!userId || username === 'Anonymous') return;
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
            const scores = await res.json();
            leaderboardList.innerHTML = '';
            scores.forEach((s, i) => {
                const li = document.createElement('li');
                li.className = 'list-group-item bg-dark d-flex justify-content-between text-light border-secondary';
                let icon = i===0?'🥇':i===1?'🥈':i===2?'🥉':'•';
                li.innerHTML = `<div>${icon} ${s.username}</div><span class="badge bg-primary rounded-pill">${s.score}/${s.total}</span>`;
                leaderboardList.appendChild(li);
            });
        } catch (e) { console.error("Leaderboard error", e); }
    }

    function addMessageToChat(msg, sender) {
        const div = document.createElement('div');
        div.classList.add('message', sender);
        div.innerHTML = msg;
        chatWindow.appendChild(div);
        chatWindow.scrollTop = chatWindow.scrollHeight;
    }
});


