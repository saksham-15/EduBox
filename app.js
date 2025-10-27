// This is the URL of your Python server.
const API_URL = 'https://edubox-8d1v.onrender.com';

// A variable to keep track of our quiz state
let currentQuestionId = null;

// Get references to the HTML elements
const chatWindow = document.getElementById('chat-window');
const chatInput = document.getElementById('chat-input');
const sendButton = document.getElementById('send-btn');

// --- Event Listeners ---
// Run the 'sendMessage' function when the 'Send' button is clicked
sendButton.addEventListener('click', sendMessage);

// Run the 'sendMessage' function when the 'Enter' key is pressed
chatInput.addEventListener('keyup', function(event) {
    if (event.key === 'Enter') {
        sendMessage();
    }
});

// --- Main Functions ---

// 1. Called when the user clicks 'Send' or presses 'Enter'
async function sendMessage() {
    const userMessage = chatInput.value.trim();
    if (userMessage === "") return; // Don't send empty messages

    // Display the user's message in the chat
    addMessageToChat(userMessage, 'user');
    
    // Clear the input box
    chatInput.value = '';

    // Check if we are answering a quiz question or just chatting
    if (currentQuestionId) {
        // If we are in a quiz, submit the answer
        await submitQuizAnswer(userMessage);
    } else {
        // If we are not in a quiz, send to the normal chatbot
        await sendChatMessage(userMessage);
    }
}

// 2. Sends a message to your Python '/chat' endpoint
async function sendChatMessage(message) {
    try {
        const response = await fetch(`${API_URL}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: message })
        });
        
        const data = await response.json();
        const botReply = data.reply;
        
        addMessageToChat(botReply, 'bot');

        // Check if the bot wants to start a quiz
        if (botReply.includes("Here is your first question:")) {
            // The bot triggered the quiz! Let's get the first question.
            await getQuizQuestion('q1');
        }

    } catch (error) {
        console.error('Error sending chat message:', error);
        addMessageToChat('Sorry, I am having trouble connecting to my brain.', 'bot');
    }
}

// 3. Gets a quiz question from your Python '/quiz/<id>' endpoint
async function getQuizQuestion(questionId) {
    try {
        const response = await fetch(`${API_URL}/quiz/${questionId}`);
        const data = await response.json();

        if (data.error) {
            addMessageToChat(data.error, 'bot');
            return;
        }

        // Display the question and options
        let questionText = `Question: ${data.question}\nOptions:\n`;
        data.options.forEach(option => {
            questionText += `- ${option}\n`;
        });
        
        addMessageToChat(questionText, 'bot');
        
        // Remember which question we are on
        currentQuestionId = data.id;

    } catch (error) {
        console.error('Error getting quiz question:', error);
    }
}

// 4. Submits an answer to your Python '/submit_answer' endpoint
// --- REPLACE IT WITH THIS ---
async function submitQuizAnswer(userAnswer) {
    try {
        const response = await fetch(`${API_URL}/submit_answer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                question_id: currentQuestionId,
                user_answer: userAnswer
            })
        });

        const data = await response.json();
        
        // 1. Display the feedback (e.g., "Correct! Great job.")
        addMessageToChat(data.feedback, 'bot');

        // 2. Check if the answer was correct
        if (data.correct) {
            // --- THIS IS THE NEW LOGIC ---
            
            // Get the number from the current question ID (e.g., "q1" -> 1)
            const currentNum = parseInt(currentQuestionId.replace('q', ''));
            
            // Increment to get the next question number
            const nextNum = currentNum + 1;

            // Check if they finished all 10 questions
            if (nextNum > 10) {
                addMessageToChat("Congratulations! You've completed all 10 questions!", 'bot');
                currentQuestionId = null; // Quiz is over, reset.
            } else {
                // It's not over, so get the next question ID (e.g., "q2")
                const nextQuestionId = 'q' + nextNum;
                
                // Wait 1 second for a natural feel, then show the next question
                setTimeout(() => {
                    addMessageToChat("Here's your next question:", 'bot');
                    getQuizQuestion(nextQuestionId); // This will fetch q2, q3, etc.
                }, 1000); // 1000ms = 1 second delay
            }
            // --- END OF NEW LOGIC ---

        } else {
            // Answer was wrong. Reset the quiz state.
            addMessageToChat('Sorry, that was incorrect. The quiz is over. Type "quiz" to try again.', 'bot');
            currentQuestionId = null;
        }

    } catch (error) {
        console.error('Error submitting answer:', error);
    }
}

// --- Utility Function ---

// Adds a new message to the chat window UI
function addMessageToChat(message, sender) {
    // Create a new 'div' element
    const messageElement = document.createElement('div');
    
    // Add CSS classes
    messageElement.classList.add('message');
    messageElement.classList.add(sender); // 'user' or 'bot'
    
    // Set the text, replacing newline characters with HTML breaks
    messageElement.innerHTML = message.replace(/\n/g, '<br>');
    
    // Add the new message to the chat window
    chatWindow.appendChild(messageElement);
    
    // Scroll to the bottom
    chatWindow.scrollTop = chatWindow.scrollHeight;

}
