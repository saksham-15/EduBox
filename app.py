from flask import Flask, jsonify, request
from flask_cors import CORS
import os

# --- Initialization ---
app = Flask(__name__)
# Allow access from all origins to fix CORS errors
CORS(app) 

# --- 1. IN-MEMORY DATA STORE (Simpler & Faster than Firestore for this step) ---

# Stores the leaderboard in the server's memory
LEADERBOARD_DATA = []

# Hardcoded Quiz Data to ensure it matches your Frontend logic perfectly
QUIZ_DATA = {
    "q1": {
        "question": "What does EC2 stand for?", 
        "options": ["Elastic Compute Cloud", "Elastic Cloud Compute", "Easy Cloud Computing", "Electric Computer Cloud"], 
        "answer": "Elastic Compute Cloud"
    },
    "q2": {
        "question": "Which service is used for object storage?", 
        "options": ["EBS", "S3", "EFS", "Glacier"], 
        "answer": "S3"
    },
    "q3": {
        "question": "What AWS service is a NoSQL database?", 
        "options": ["RDS", "DynamoDB", "S3", "EC2"], 
        "answer": "DynamoDB"
    },
    "q4": {
        "question": "Which service handles Identity and Access Management?", 
        "options": ["IAM", "KMS", "Cognito", "WAF"], 
        "answer": "IAM"
    },
    "q5": {
        "question": "What is the serverless compute service in AWS?", 
        "options": ["EC2", "Lambda", "Fargate", "Lightsail"], 
        "answer": "Lambda"
    },
    "q6": {
        "question": "Which service is used for Content Delivery Network (CDN)?", 
        "options": ["CloudFront", "Route53", "Direct Connect", "VPC"], 
        "answer": "CloudFront"
    },
    "q7": {
        "question": "What service monitors your AWS resources?", 
        "options": ["CloudTrail", "CloudWatch", "Config", "Inspector"], 
        "answer": "CloudWatch"
    },
    "q8": {
        "question": "Which database engine is NOT supported by RDS?", 
        "options": ["MySQL", "PostgreSQL", "MongoDB", "Aurora"], 
        "answer": "MongoDB"
    },
    "q9": {
        "question": "What is used to define a Virtual Network in AWS?", 
        "options": ["VPC", "VPN", "Subnet", "Gateway"], 
        "answer": "VPC"
    },
    "q10": {
        "question": "Which service is best for data warehousing?", 
        "options": ["RDS", "Redshift", "DynamoDB", "Athena"], 
        "answer": "Redshift"
    }
}

# --- 2. ROUTES ---

@app.route('/', methods=['GET'])
def home():
    return jsonify({
        "status": "API Running", 
        "message": "EduBox Backend is active. Use /chat or /quiz endpoints."
    })

@app.route('/chat', methods=['POST'])
def chat():
    data = request.json
    user_message = data.get('message', '').lower()

    # Logic to trigger the quiz
    if 'quiz' in user_message or 'game' in user_message:
        return jsonify({
            "reply": "Great! Let's start the quiz. Here is your first question:",
            "action": "start_quiz" # This helps the frontend know it's time to start
        })
    elif 'aws' in user_message:
        return jsonify({"reply": "AWS is the leading cloud platform. Type 'quiz' to test your knowledge!"})
    elif 'hello' in user_message or 'hi' in user_message:
        return jsonify({"reply": "Hello! I am EduBox. Type 'quiz' to start a Cloud Computing challenge."})
    else:
        return jsonify({"reply": "I didn't catch that. Try typing 'hello' or 'quiz'."})

@app.route('/quiz/<question_id>', methods=['GET'])
def get_question(question_id):
    """ Fetches question data from our local dictionary """
    question = QUIZ_DATA.get(question_id)
    if question:
        return jsonify({
            "id": question_id, 
            "question": question["question"], 
            "options": question["options"]
        })
    return jsonify({"error": "Question not found"}), 404

@app.route('/submit_answer', methods=['POST'])
def submit_answer():
    """ Validates the answer sent by the Frontend """
    data = request.json
    question_id = data.get('question_id')
    user_answer = data.get('user_answer') # This will be "DynamoDB", "S3", etc.
    
    if not question_id or not user_answer:
        return jsonify({"error": "Missing data"}), 400

    question = QUIZ_DATA.get(question_id)
    if not question:
        return jsonify({"error": "Question not found"}), 404
    
    correct_answer = question["answer"]
    
    # Compare the text directly
    if user_answer == correct_answer:
        return jsonify({"correct": True, "feedback": "Correct! Great job."})
    else:
        return jsonify({
            "correct": False, 
            "feedback": f"Sorry, the correct answer was {correct_answer}."
        })

# --- 3. LEADERBOARD ENDPOINTS (Required for the feature you asked for) ---

@app.route('/score', methods=['POST'])
def save_score():
    data = request.json
    username = data.get('username')
    score = data.get('score')
    total = data.get('total')
    
    if not username or score is None:
        return jsonify({"message": "Invalid data"}), 400
        
    # Add to our global list
    LEADERBOARD_DATA.append({
        "username": username,
        "score": score,
        "total": total
    })
    
    # Sort: High scores at the top
    LEADERBOARD_DATA.sort(key=lambda x: x['score'], reverse=True)
    
    # Keep only top 10 scores to prevent list from getting too big
    if len(LEADERBOARD_DATA) > 10:
        LEADERBOARD_DATA.pop()
        
    return jsonify({"message": "Score saved successfully!"})

@app.route('/leaderboard', methods=['GET'])
def get_leaderboard():
    return jsonify(LEADERBOARD_DATA)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
