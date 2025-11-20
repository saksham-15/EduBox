// --- CONFIGURATION ---
// IMPORTANT: This must be your live, deployed Render URL
const API_URL = 'https://edubox-0d1v.onrender.com';

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

/**
 * Handles sending a message, either as a chat query or a quiz answer.
 */
async function sendMessage() {
    const userMessage = chatInput.value.trim();
    if (userMessage === "") return; // Don't send empty messages

    // Display the user's message in the chat
    addMessageToChat(userMessage, 'user');
    
    // Clear the input box
    chatInput.value = '';

    // Check if we are answering a quiz question or just chatting
    if (currentQuestionId) {
        // If we are in a quiz, submit the answer (A, B, C, D)
        await submitQuizAnswer(userMessage);
    } else {
        // If we are not in a quiz, send to the normal chatbot
        await sendChatMessage(userMessage);
    }
}

/**
 * Sends a message to the Python '/chat' endpoint.
 */
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
        addMessageToChat('Sorry, I am having trouble connecting to my brain. Check the browser console for details.', 'bot');
    }
}

/**
 * Gets a quiz question from the Python '/quiz/<id>' endpoint and formats options as A, B, C, D.
 */
async function getQuizQuestion(questionId) {
    try {
        const response = await fetch(`${API_URL}/quiz/${questionId}`);
        const data = await response.json();

        if (data.error) {
            addMessageToChat(data.error, 'bot');
            return;
        }

        // --- NEW LOGIC: Display options with A, B, C, D prefixes ---
        let questionText = `Question: ${data.question}\n\nChoose an option (A, B, C, D):\n`;
        const letters = ['A', 'B', 'C', 'D'];
        
        data.options.forEach((option, index) => {
            if (index < letters.length) { 
                questionText += `${letters[index]}) ${option}\n`;
            }
        });
        
        addMessageToChat(questionText, 'bot');
        
        // Remember which question we are on
        currentQuestionId = data.id;

    } catch (error) {
        console.error('Error getting quiz question:', error);
        addMessageToChat('Failed to load the quiz question.', 'bot');
    }
}

/**
 * Submits an answer (A, B, C, or D) to the Python '/submit_answer' endpoint.
 */
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
        
        // 1. Display the feedback 
        addMessageToChat(data.feedback, 'bot');

        // 2. Check if the answer was correct
        if (data.correct) {
            
            // Get the number from the current question ID (e.g., "q1" -> 1)
            const currentNum = parseInt(currentQuestionId.replace('q', ''));
            
            // Increment to get the next question number
            const nextNum = currentNum + 1;

            // Check if they finished all 10 questions
            if (nextNum > 10) {
                addMessageToChat("Congratulations! You've completed all 10 questions!", 'bot');
                currentQuestionId = null; // Quiz is over, reset.
            } else {
                // Get the next question ID (e.g., "q2")
                const nextQuestionId = 'q' + nextNum;
                
                // Wait 1 second for a natural feel, then show the next question
                setTimeout(() => {
                    addMessageToChat("Here's your next question:", 'bot');
                    getQuizQuestion(nextQuestionId); // This will fetch q2, q3, etc.
                }, 1000); 
            }

        } else if (!data.correct && data.error === undefined) {
            // Answer was wrong or invalid. Reset the quiz state only if it's a defined end-of-quiz state.
            // The backend sends specific feedback, so we just reset the state.
            addMessageToChat('Quiz ended. Type "quiz" to try again.', 'bot');
            currentQuestionId = null;
        } else {
            // If the backend sent an error message (like invalid input), we don't reset the state 
            // and let the user try again for the same question.
        }

    } catch (error) {
        console.error('Error submitting answer:', error);
        addMessageToChat('Failed to submit answer due to a network error.', 'bot');
    }
}

// --- Utility Function ---

/**
 * Adds a new message to the chat window UI and scrolls to the bottom.
 */
function addMessageToChat(message, sender) {
    // Create a new 'div' element
    const messageElement = document.createElement('div');
    
    // Add CSS classes (these map to the classes in index.html)
    messageElement.classList.add('message');
    messageElement.classList.add(sender); // 'user' or 'bot'
    
    // Set the text, replacing newline characters with HTML breaks
    // (We use innerHTML because the quiz question has multiple line breaks)
    messageElement.innerHTML = message.replace(/\n/g, '<br>');
    
    // Add the new message to the chat window
    chatWindow.appendChild(messageElement);
    
    // Scroll to the bottom
    chatWindow.scrollTop = chatWindow.scrollHeight;
}
