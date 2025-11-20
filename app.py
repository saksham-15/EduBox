from flask import Flask, jsonify, request
from flask_cors import CORS
import os

app = Flask(__name__)
CORS(app)

# --- IN-MEMORY DATABASE ---
# Stores scores as long as the server is running.
LEADERBOARD_DATA = []

# Quiz Data (10 Questions)
QUIZ_DATA = {
    "q1": {"question": "What does EC2 stand for?", "options": ["Elastic Compute Cloud", "Elastic Cloud Compute", "Easy Cloud Computing", "Electric Computer Cloud"], "answer": "Elastic Compute Cloud"},
    "q2": {"question": "Which service is used for object storage?", "options": ["EBS", "S3", "EFS", "Glacier"], "answer": "S3"},
    "q3": {"question": "What AWS service is a NoSQL database?", "options": ["RDS", "DynamoDB", "S3", "EC2"], "answer": "DynamoDB"},
    "q4": {"question": "Which service handles Identity and Access Management?", "options": ["IAM", "KMS", "Cognito", "WAF"], "answer": "IAM"},
    "q5": {"question": "What is the serverless compute service in AWS?", "options": ["EC2", "Lambda", "Fargate", "Lightsail"], "answer": "Lambda"},
    "q6": {"question": "Which service is used for Content Delivery Network (CDN)?", "options": ["CloudFront", "Route53", "Direct Connect", "VPC"], "answer": "CloudFront"},
    "q7": {"question": "What service monitors your AWS resources?", "options": ["CloudTrail", "CloudWatch", "Config", "Inspector"], "answer": "CloudWatch"},
    "q8": {"question": "Which database engine is NOT supported by RDS?", "options": ["MySQL", "PostgreSQL", "MongoDB", "Aurora"], "answer": "MongoDB"},
    "q9": {"question": "What is used to define a Virtual Network in AWS?", "options": ["VPC", "VPN", "Subnet", "Gateway"], "answer": "VPC"},
    "q10": {"question": "What are the three main service models of cloud computing?", "options": ["IaaS, PaaS, SaaS", "DaaS, AaaS, FaaS", "WAN, LAN, MAN", "REST, SOAP, HTTP"], "answer": "IaaS, PaaS, SaaS"}
}

# --- ROUTES ---

@app.route('/')
def home():
    return jsonify({"status": "API Active", "message": "EduBox Backend Running"})

@app.route('/chat', methods=['POST'])
def chat():
    data = request.json
    user_message = data.get('message', '').lower()
    
    if 'quiz' in user_message or 'game' in user_message:
        return jsonify({"reply": "Great! Let's start the quiz. Here is your first question:", "action": "start_quiz"})
    elif 'hello' in user_message or 'hi' in user_message:
        return jsonify({"reply": "Hello! I'm EduBox. Type 'quiz' to test your Cloud knowledge."})
    else:
        return jsonify({"reply": "I didn't catch that. Type 'quiz' to start!"})

@app.route('/quiz/<qid>', methods=['GET'])
def get_question(qid):
    q = QUIZ_DATA.get(qid)
    if q:
        return jsonify({"id": qid, "question": q["question"], "options": q["options"]})
    return jsonify({"error": "Question not found"}), 404

@app.route('/submit_answer', methods=['POST'])
def submit_answer():
    data = request.json
    qid = data.get('question_id')
    ans = data.get('user_answer') 
    
    if not qid or not ans: return jsonify({"error": "Missing data"}), 400
    
    question_obj = QUIZ_DATA.get(qid)
    if not question_obj:
        return jsonify({"error": "Invalid Question ID"}), 404
        
    correct = question_obj["answer"]
    
    if ans == correct:
        return jsonify({"correct": True, "feedback": "Correct! Great job."})
    else:
        return jsonify({"correct": False, "feedback": f"Sorry, the correct answer was {correct}."})

@app.route('/score', methods=['POST'])
def save_score():
    data = request.json
    username = data.get('username')
    score = data.get('score')
    total = data.get('total')
    
    if not username or score is None: return jsonify({"message": "Invalid data"}), 400
    
    LEADERBOARD_DATA.append({"username": username, "score": score, "total": total})
    
    # Sort by Score (High to Low)
    LEADERBOARD_DATA.sort(key=lambda x: x['score'], reverse=True)
    
    # Keep top 10
    if len(LEADERBOARD_DATA) > 10: LEADERBOARD_DATA.pop()
        
    return jsonify({"message": "Score saved!"})

@app.route('/leaderboard', methods=['GET'])
def get_leaderboard():
    return jsonify(LEADERBOARD_DATA)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
