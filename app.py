import os
import firebase_admin
from firebase_admin import credentials, firestore
from flask import Flask, request, jsonify
from flask_cors import CORS
import json # Added for loading credentials from JSON string

# --- Initialization ---

# Initialize Flask App
app = Flask(__name__)
# Allow access from all origins (required for frontend running on GitHub Pages)
CORS(app) 

# Initialize Firebase
try:
    # 1. Load from environment variable (REQUIRED for Render deployment)
    if os.environ.get('FIREBASE_CREDENTIALS_JSON'):
        print("Attempting to load credentials from environment variable...")
        # Load the JSON string from the environment variable
        cred_json = json.loads(os.environ.get('FIREBASE_CREDENTIALS_JSON'))
        cred = credentials.Certificate(cred_json)
        
    # 2. Fallback to local file (used when running locally)
    else:
        print("Attempting to load credentials from local file (Dev Mode)...")
        cred = credentials.Certificate('firebase_key.json')
        
    firebase_admin.initialize_app(cred)
    print("✅ Firebase initialized successfully.")
    
except FileNotFoundError:
    print("❌ ERROR: 'firebase_key.json' not found. Check local file path.")
    exit()
except Exception as e:
    # This catches failures in loading the JSON or Firebase initialization
    print(f"❌ ERROR: Failed to initialize Firebase: {e}")
    # The exit is necessary to prevent the app from starting without a database connection
    exit()

# Get a reference to the Firestore database
db = firestore.client()

# --- 0. Root Route (to prevent 500/404 on API URL check) ---

@app.route('/', methods=['GET'])
def home():
    """
    Simple route to confirm the API is running when hitting the root URL.
    """
    return jsonify({
        "status": "API Running",
        "message": "This is the backend API. Please use the /chat or /quiz routes.",
        "version": "1.0"
    })

# --- 1. Chatbot Engine ---

@app.route('/chat', methods=['POST'])
def chat():
    """
    Handles conversation flow.
    Expects a JSON request like: {"message": "hello"}
    """
    data = request.json
    user_message = data.get('message', '').lower()

    if 'hello' in user_message or 'hi' in user_message:
        response_message = "Hi there! I'm a cloud chatbot. You can ask me about services or type 'quiz' to start a game."
    
    elif 'quiz' in user_message or 'game' in user_message:
        response_message = "Great! Let's start the quiz. Here is your first question:"

    elif 'aws' in user_message:
        response_message = "AWS (Amazon Web Services) is a popular cloud platform. I can quiz you on it!"

    else:
        response_message = "Sorry, I don't understand that. Try typing 'hello' or 'quiz'."

    return jsonify({"reply": response_message})

# --- 2. Quiz Module (Getting Questions) ---

@app.route('/quiz/<question_id>', methods=['GET'])
def get_question(question_id):
    """
    Fetches a specific quiz question from Firestore.
    """
    try:
        # Get the document from the 'edubox-6918' collection
        question_ref = db.collection('edubox-6918').document(question_id)
        doc = question_ref.get()

        if not doc.exists:
            return jsonify({"error": "Question not found"}), 404

        question_data = doc.to_dict()

        # IMPORTANT: Remove the answer before sending it to the user!
        if 'answer' in question_data:
            del question_data['answer']
        
        question_data['id'] = doc.id
        
        return jsonify(question_data)

    except Exception as e:
        return jsonify({"error": str(e)}), 500

# --- 3. Quiz Module (Submitting Answers) ---

@app.route('/submit_answer', methods=['POST'])
def submit_answer():
    """
    Checks a user's answer (A, B, C, or D) against the correct answer text in Firestore.
    """
    data = request.json
    question_id = data.get('question_id')
    # Clean and capitalize user input (e.g., "a" -> "A")
    user_answer = data.get('user_answer', '').strip().upper() 

    if not question_id or not user_answer:
        return jsonify({"error": "Missing 'question_id' or 'user_answer'"}), 400

    # Validate that the input is a single letter option
    if user_answer not in ('A', 'B', 'C', 'D'):
        # Send a specific non-crashing response for invalid input
        return jsonify({
            "correct": False,
            "feedback": f"Invalid input. Please respond with only A, B, C, or D."
        }), 200

    try:
        question_ref = db.collection('edubox-6918').document(question_id)
        doc = question_ref.get()

        if not doc.exists:
            return jsonify({"error": "Question not found"}), 404

        question_data = doc.to_dict()
        correct_answer_text = question_data.get('answer')
        options_list = question_data.get('options')
        
        # --- NEW LOGIC: Map letter (A, B, C, D) to option text ---
        
        # Calculate the numerical index the user chose (A=0, B=1, C=2, etc.)
        user_chosen_index = ord(user_answer) - ord('A')
        
        # Check if the chosen index is valid for the number of options available
        if user_chosen_index >= len(options_list):
             return jsonify({
                "correct": False,
                "feedback": "Invalid option selected for this question. Please try again."
            }), 200

        # Get the actual text of the option the user selected
        user_selected_option_text = options_list[user_chosen_index]
        
        # --- Evaluate the Answer ---
        if user_selected_option_text == correct_answer_text:
            feedback = "Correct! Great job."
            is_correct = True
        else:
            feedback = f"Sorry, that was incorrect. The correct answer was: {correct_answer_text}."
            is_correct = False
            
            # The quiz ends if the answer is wrong
            feedback += "\nThe quiz is now over."

        return jsonify({
            "correct": is_correct,
            "feedback": feedback
        })

    except Exception as e:
        # Log the full error to the Render console for debugging
        print(f"Error processing submit_answer: {e}") 
        return jsonify({"error": "An internal server error occurred during answer evaluation."}), 500

# --- Running the App ---

if __name__ == '__main__':
    # This runs the app locally for development
    app.run(host='0.0.0.0', port=5000, debug=True)
