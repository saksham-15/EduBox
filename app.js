// --- CONFIGURATION ---

// Your live Render Backend URL
const API_URL = 'https://edubox-0d1v.onrender.com';

// Firebase Configuration (Keys successfully extracted and inserted)
const firebaseConfig = {
  apiKey: "AIzaSyDQA-LI0D1qBkaHcqSO-xIbkXbncxQTSHd4",
  authDomain: "edubox-6918.firebaseapp.com",
  projectId: "edubox-6918",
  storageBucket: "edubox-6918.firebasestorage.app",
  messagingSenderId: "457758932957",
  appId: "1:457758932957:web:792b61c58c6396128d8034",
  measurementId: "G-W2LP8BP1VQ"
};

// --- STATE MANAGEMENT (Global) ---
let currentQuestionId = null;
let quizScore = 0;
let totalQuestions = 0;
let userId = null;
let username = null;

// --- INITIALIZATION AND MAIN LOGIC (Wrapped in DOMContentLoaded) ---

// Wait for all HTML elements and Firebase SDKs to load before running code
document.addEventListener('DOMContentLoaded', () => {

    // --- DOM REFERENCES ---
    const authScreen = document.getElementById('auth-screen');
    const mainApp = document.getElementById('main-app');
    const chatWindow = document.getElementById('chat-window');
    const chatInput = document.getElementById('chat-input');
    const sendButton = document.getElementById('send-btn');
    const userDisplay = document.getElementById('user-display');
    const leaderboardList = document.getElementById('leaderboard-list');
    const authErrors = document.getElementById('auth-errors');

    // Auth DOM elements
    const usernameInput = document.getElementById('username-input');
    const passwordInput = document.getElementById('password-input');
    const loginBtn = document.getElementById('login-btn');
    const signupBtn = document.getElementById('signup-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const anonymousBtn = document.getElementById('anonymous-btn');

    // --- FIREBASE INITIALIZATION ---
    // Initialize Firebase (This MUST happen after the SDK scripts are loaded)
    const app = firebase.initializeApp(firebaseConfig);
    const auth = firebase.auth();

    // --- AUTHENTICATION HANDLERS ---

    const displayAuthError = (message) => {
        authErrors.textContent = message;
        authErrors.classList.remove('d-none');
        setTimeout(() => authErrors.classList.add('d-none'), 5000);
    };

    // Handle Sign Up
    signupBtn.addEventListener('click', async () => {
        const name = usernameInput.value.trim();
        if (!name) return displayAuthError("Please enter a username.");
        
        const email = name + "@edubox.com"; 
        const password = passwordInput.value.trim();
        
        if (password.length < 6) {
            return displayAuthError("Password must be at least 6 characters.");
        }
        
        try {
            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            await userCredential.user.updateProfile({ displayName: name }); 
        } catch (error) {
            displayAuthError(error.message);
        }
    });

    // Handle Login
    loginBtn.addEventListener('click', async () => {
        const name = usernameInput.value.trim();
        if (!name) return displayAuthError("Please enter a username.");

        const email = name + "@edubox.com";
        const password = passwordInput.value.trim();
        
        try {
            await auth.signInWithEmailAndPassword(email, password);
        } catch (error) {
            displayAuthError("Login failed: " + error.message);
        }
    });

    // Handle Anonymous Sign In
    anonymousBtn.addEventListener('click', async () => {
        try {
            await auth.signInAnonymously();
        } catch (error) {
            displayAuthError(error.message);
        }
    });

    // Handle Logout
    logoutBtn.addEventListener('click', async () => {
        try {
            await auth.signOut();
        } catch (error) {
            console.error("Logout failed:", error);
        }
    });

    // Auth State Observer
    auth.onAuthStateChanged((user) => {
        if (user) {
            // User is signed in
            userId = user.uid;
            username = user.displayName || 'Anonymous User';
            userDisplay.textContent = `User: ${username}`;
            
            authScreen.style.display = 'none';
            mainApp.style.display = 'flex';
            
            fetchLeaderboard();
            addMessageToChat(`Welcome back, ${username}! Type 'quiz' to start.`, 'bot');
        } else {
            // User is signed out
            userId = null;
            username = null;
            
            authScreen.style.display = 'flex';
            mainApp.style.display = 'none';
        }
    });

    // --- CHAT & QUIZ LOGIC ---

    sendButton.addEventListener('click', sendMessage);
    chatInput.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') sendMessage();
    });

    async function sendMessage() {
        if (!userId) return displayAuthError("Please log in first.");

        const text = chatInput.value.trim();
        if (!text) return;

        addMessageToChat(text, 'user');
        chatInput.value = '';

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

            if (data.reply.includes("Here is your first question:")) {
                quizScore = 0; 
                totalQuestions = 0;
                await getQuizQuestion('q1');
            }
        } catch (e) {
            console.error(e);
            addMessageToChat("Backend connection failed.", 'bot');
        }
    }

    async function getQuizQuestion(qid) {
        try {
            const res = await fetch(`${API_URL}/quiz/${qid}`);
            const data = await res.json();
            
            if (data.error) {
                addMessageToChat(data.error, 'bot');
                return;
            }

            let text = `Question: ${data.question}\n\nChoose (A, B, C, D):\n`;
            const letters = ['A','B','C','D'];
            data.options.forEach((opt, i) => {
                if(i < 4) text += `${letters[i]}) ${opt}\n`;
            });

            addMessageToChat(text, 'bot');
            currentQuestionId = data.id;
        } catch (e) {
            addMessageToChat("Failed to load question.", 'bot');
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
            addMessageToChat(data.feedback, 'bot');

            if (data.correct) {
                quizScore++;
                const nextNum = parseInt(currentQuestionId.replace('q','')) + 1;
                
                if (nextNum > 10) {
                    addMessageToChat(`Quiz Complete! Score: ${quizScore}/${totalQuestions}`, 'bot');
                    await submitFinalScore(quizScore, totalQuestions);
                    currentQuestionId = null;
                } else {
                    setTimeout(() => {
                        addMessageToChat("Next question:", 'bot');
                        getQuizQuestion('q' + nextNum);
                    }, 1000);
                }
            } else if (!data.correct && data.feedback.includes("over")) {
                currentQuestionId = null;
                addMessageToChat(`Game Over. Score: ${quizScore}/${totalQuestions}`, 'bot');
            } else if (data.feedback.includes("Invalid")) {
                totalQuestions--;
            }
        } catch (e) {
            addMessageToChat("Error submitting answer.", 'bot');
        }
    }

    async function submitFinalScore(s, t) {
        try {
            const res = await fetch(`${API_URL}/score`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, username, score: s, total: t })
            });
            const data = await res.json();
            addMessageToChat(data.message, 'bot');
            fetchLeaderboard();
        } catch (e) { console.error(e); }
    }

    async function fetchLeaderboard() {
        leaderboardList.innerHTML = '<li class="list-group-item bg-dark text-muted">Loading...</li>';
        try {
            const res = await fetch(`${API_URL}/leaderboard`);
            const scores = await res.json();
            leaderboardList.innerHTML = '';
            
            if (!scores.length) {
                leaderboardList.innerHTML = '<li class="list-group-item bg-dark">No scores yet</li>';
                return;
            }
            
            scores.forEach((s, i) => {
                const li = document.createElement('li');
                li.className = 'list-group-item bg-dark d-flex justify-content-between text-light';
                let medal = i===0?'🥇 ':i===1?'🥈 ':i===2?'🥉 ':'';
                li.innerHTML = `<div>${medal} <strong>${s.username}</strong></div><span class="badge bg-warning rounded-pill">${s.score}/${s.total}</span>`;
                leaderboardList.appendChild(li);
            });
        } catch (e) {
            leaderboardList.innerHTML = '<li class="list-group-item bg-dark text-danger">Error fetching leaderboard.</li>';
        }
    }

    function addMessageToChat(msg, sender) {
        const div = document.createElement('div');
        div.classList.add('message', sender);
        div.innerHTML = msg.replace(/\n/g, '<br>');
        chatWindow.appendChild(div);
        chatWindow.scrollTop = chatWindow.scrollHeight;
    }
}); // End of DOMContentLoaded listener
