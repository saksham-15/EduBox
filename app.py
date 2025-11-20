import os
import firebase_admin
from firebase_admin import credentials, firestore
from flask import Flask, request, jsonify
from flask_cors import CORS
import json # <-- ADD THIS IMPORT

# --- Initialization ---

# Initialize Flask App
app = Flask(__name__)
CORS(app) 

# Initialize Firebase
try:
    # 1. Check for the environment variable (used on Render)
    if os.environ.get('FIREBASE_CREDENTIALS_JSON'):
        # Load the JSON string into a Python object for the Certificate function
        cred_json = json.loads(os.environ.get('FIREBASE_CREDENTIALS_JSON'))
        cred = credentials.Certificate(cred_json)
        
    # 2. Fallback to local file (used when running on your machine)
    else:
        cred = credentials.Certificate('firebase_key.json')
        
    firebase_admin.initialize_app(cred)
    print("✅ Firebase initialized successfully.")
    
except FileNotFoundError:
    print("❌ ERROR: 'firebase_key.json' not found (running locally?).")
    exit()
except Exception as e:
    # If this prints on Render, it means the variable is there but malformed
    print(f"❌ ERROR: Failed to initialize Firebase: {e}")
    print("HINT: Check the FIREBASE_CREDENTIALS_JSON variable on Render.")
    exit()

# Get a reference to the Firestore database
db = firestore.client()

# ... (rest of your Flask routes) ...

# --- 1. Chatbot Engine ---
# This part handles the "Chatbot Engine" from your proposal

@app.route('/chat', methods=['POST'])
def chat():
    """
    Handles conversation flow.
    Expects a JSON request like: {"message": "hello"}
    """
    # Get the user's message from the request
    data = request.json
    user_message = data.get('message', '').lower()

    # Simple conversation logic
    if 'hello' in user_message or 'hi' in user_message:
        response_message = "Hi there! I'm a cloud chatbot. You can ask me about services or type 'quiz' to start a game."
    
    elif 'quiz' in user_message or 'game' in user_message:
        response_message = "Great! Let's start the quiz. Here is your first question:"

    elif 'aws' in user_message:
        response_message = "AWS (Amazon Web Services) is a popular cloud platform. I can quiz you on it!"

    else:
        response_message = "Sorry, I don't understand that. Try typing 'hello' or 'quiz'."

    # Return the response as JSON
    return jsonify({"reply": response_message})

# --- 2. Quiz Module (Getting Questions) ---
# This part handles the "Quiz Module" and "Data Storage" from your proposal

@app.route('/quiz/<question_id>', methods=['GET'])
def get_question(question_id):
    """
    Fetches a specific quiz question from Firestore.
    The 'question_id' (e.g., 'q1') is passed in the URL.
    """
    try:
        # Get the document from the 'edubox-6918' collection
        question_ref = db.collection('edubox-6918').document(question_id)
        doc = question_ref.get()

        if not doc.exists:
            return jsonify({"error": "Question not found"}), 404

        # Get the data from the document
        question_data = doc.to_dict()

        # IMPORTANT: Remove the answer before sending it to the user!
        # This prevents cheating.
        if 'answer' in question_data:
            del question_data['answer']
        
        # Add the question ID to the response
        question_data['id'] = doc.id
        
        # Return the question and options
        return jsonify(question_data)

    except Exception as e:
        return jsonify({"error": str(e)}), 500

# --- 3. Quiz Module (Submitting Answers) ---
# This part evaluates answers and could be used to track scores

@app.route('/submit_answer', methods=['POST'])
def submit_answer():
    """
    Checks a user's answer against the correct answer in Firestore.
    Expects a JSON request like:
    {
        "question_id": "q1",
        "user_answer": "DynamoDB"
    }
    """
    data = request.json
    question_id = data.get('question_id')
    user_answer = data.get('user_answer')

    if not question_id or not user_answer:
        return jsonify({"error": "Missing 'question_id' or 'user_answer'"}), 400

    try:
        # Get the document again, this time to check the answer
        question_ref = db.collection('edubox-6918').document(question_id)
        doc = question_ref.get()

        if not doc.exists:
            return jsonify({"error": "Question not found"}), 404

        correct_answer = doc.to_dict().get('answer')

        # Evaluate the answer
        if user_answer == correct_answer:
            feedback = "Correct! Great job."
            is_correct = True
        else:
            feedback = f"Sorry, the correct answer was {correct_answer}."
            is_correct = False

        # Return the result
        # Your "Output Layer" would use this info
        return jsonify({
            "correct": is_correct,
            "feedback": feedback
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500

# --- Running the App ---

if __name__ == '__main__':
    # Sets the host to '0.0.0.0' to make it accessible on your network

    app.run(host='0.0.0.0', port=5000, debug=True)    
