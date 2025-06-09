from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, responses
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timedelta
import jwt
import bcrypt
from enum import Enum
import json
from bson.objectid import ObjectId

# Custom JSON encoder to handle ObjectId
class CustomJSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, ObjectId):
            return str(obj)
        if isinstance(obj, datetime):
            return obj.isoformat()
        return super().default(obj)

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# JWT Configuration
SECRET_KEY = "your-secret-key-change-in-production"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 1440  # 24 hours

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI(default_response_class=responses.JSONResponse)

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Security
security = HTTPBearer()

# Enums
class UserRole(str, Enum):
    ADMIN = "admin"
    STUDENT = "student"

class QuestionType(str, Enum):
    OBJECTIVE = "objective"
    THEORY = "theory"

# Models
class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: str
    email: str
    password: str
    role: UserRole
    created_at: datetime = Field(default_factory=datetime.utcnow)

class UserCreate(BaseModel):
    username: str
    email: str
    password: str
    role: UserRole = UserRole.STUDENT

class UserLogin(BaseModel):
    username: str
    password: str

class Question(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    question_text: str
    question_type: QuestionType
    options: Optional[List[str]] = None  # For objective questions
    correct_answer: str
    explanation: str
    points: int = 1
    created_by: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

class QuestionCreate(BaseModel):
    question_text: str
    question_type: QuestionType
    options: Optional[List[str]] = None
    correct_answer: str
    explanation: str
    points: int = 1

class Quiz(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: str
    questions: List[str]  # Question IDs
    time_limit: int  # in minutes
    created_by: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    is_active: bool = True

class QuizCreate(BaseModel):
    title: str
    description: str
    questions: List[str]
    time_limit: int

class QuizAttempt(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    quiz_id: str
    student_id: str
    answers: Dict[str, str]  # question_id -> answer
    score: Optional[int] = None
    max_score: Optional[int] = None
    started_at: datetime = Field(default_factory=datetime.utcnow)
    submitted_at: Optional[datetime] = None
    time_taken: Optional[int] = None  # in seconds

class QuizSubmission(BaseModel):
    quiz_id: str
    answers: Dict[str, str]

class Token(BaseModel):
    access_token: str
    token_type: str
    user: dict

# Helper functions
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="Invalid token")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    user = await db.users.find_one({"username": username})
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    return User(**user)

async def get_admin_user(current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

# Authentication Routes
@api_router.post("/register", response_model=Token)
async def register(user: UserCreate):
    # Check if user exists
    existing_user = await db.users.find_one({"$or": [{"username": user.username}, {"email": user.email}]})
    if existing_user:
        raise HTTPException(status_code=400, detail="Username or email already exists")
    
    # Hash password
    hashed_password = hash_password(user.password)
    
    # Create user
    user_dict = user.dict()
    user_dict["password"] = hashed_password
    user_obj = User(**user_dict)
    user_data = user_obj.dict()
    
    # Remove MongoDB ObjectId if it exists and use our custom id
    if "_id" in user_data:
        del user_data["_id"]
    
    await db.users.insert_one(user_data)
    
    # Create token
    access_token = create_access_token(data={"sub": user.username})
    user_dict.pop("password")
    
    return {"access_token": access_token, "token_type": "bearer", "user": user_dict}

@api_router.post("/login", response_model=Token)
async def login(user_credentials: UserLogin):
    user = await db.users.find_one({"username": user_credentials.username})
    if not user or not verify_password(user_credentials.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    access_token = create_access_token(data={"sub": user["username"]})
    
    # Remove MongoDB ObjectId and password from response
    if "_id" in user:
        del user["_id"]
    user.pop("password")
    
    return {"access_token": access_token, "token_type": "bearer", "user": user}

@api_router.get("/me")
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    user_dict = current_user.dict()
    user_dict.pop("password")
    return user_dict

# Question Management Routes (Admin only)
@api_router.post("/questions", response_model=Question)
async def create_question(question: QuestionCreate, current_user: User = Depends(get_admin_user)):
    question_dict = question.dict()
    question_dict["created_by"] = current_user.id
    question_obj = Question(**question_dict)
    await db.questions.insert_one(question_obj.dict())
    return question_obj

@api_router.get("/questions", response_model=List[Question])
async def get_questions(current_user: User = Depends(get_admin_user)):
    questions = await db.questions.find().to_list(1000)
    return [Question(**q) for q in questions]

@api_router.delete("/questions/{question_id}")
async def delete_question(question_id: str, current_user: User = Depends(get_admin_user)):
    result = await db.questions.delete_one({"id": question_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Question not found")
    return {"message": "Question deleted successfully"}

# Quiz Management Routes (Admin only)
@api_router.post("/quizzes", response_model=Quiz)
async def create_quiz(quiz: QuizCreate, current_user: User = Depends(get_admin_user)):
    quiz_dict = quiz.dict()
    quiz_dict["created_by"] = current_user.id
    quiz_obj = Quiz(**quiz_dict)
    await db.quizzes.insert_one(quiz_obj.dict())
    return quiz_obj

@api_router.get("/quizzes", response_model=List[Quiz])
async def get_quizzes(current_user: User = Depends(get_current_user)):
    quizzes = await db.quizzes.find({"is_active": True}).to_list(1000)
    return [Quiz(**q) for q in quizzes]

@api_router.get("/quizzes/{quiz_id}")
async def get_quiz(quiz_id: str, current_user: User = Depends(get_current_user)):
    quiz = await db.quizzes.find_one({"id": quiz_id})
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    
    # Get questions for the quiz
    questions = await db.questions.find({"id": {"$in": quiz["questions"]}}).to_list(1000)
    
    # For students, don't send correct answers and explanations
    if current_user.role == UserRole.STUDENT:
        for question in questions:
            question.pop("correct_answer", None)
            question.pop("explanation", None)
    
    quiz["question_details"] = questions
    return quiz

# Quiz Attempt Routes (Students)
@api_router.post("/quizzes/{quiz_id}/start")
async def start_quiz(quiz_id: str, current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.STUDENT:
        raise HTTPException(status_code=403, detail="Only students can take quizzes")
    
    # Check if quiz exists
    quiz = await db.quizzes.find_one({"id": quiz_id, "is_active": True})
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    
    # Check if student has already attempted this quiz
    existing_attempt = await db.quiz_attempts.find_one({"quiz_id": quiz_id, "student_id": current_user.id})
    if existing_attempt:
        raise HTTPException(status_code=400, detail="You have already attempted this quiz")
    
    # Create new attempt
    attempt = QuizAttempt(quiz_id=quiz_id, student_id=current_user.id, answers={})
    await db.quiz_attempts.insert_one(attempt.dict())
    
    return {"message": "Quiz started", "attempt_id": attempt.id, "time_limit": quiz["time_limit"]}

@api_router.post("/quizzes/{quiz_id}/submit")
async def submit_quiz(quiz_id: str, submission: QuizSubmission, current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.STUDENT:
        raise HTTPException(status_code=403, detail="Only students can submit quizzes")
    
    # Find the attempt
    attempt = await db.quiz_attempts.find_one({"quiz_id": quiz_id, "student_id": current_user.id})
    if not attempt:
        raise HTTPException(status_code=404, detail="Quiz attempt not found")
    
    if attempt["submitted_at"]:
        raise HTTPException(status_code=400, detail="Quiz already submitted")
    
    # Get quiz and questions
    quiz = await db.quizzes.find_one({"id": quiz_id})
    questions = await db.questions.find({"id": {"$in": quiz["questions"]}}).to_list(1000)
    
    # Calculate score
    score = 0
    max_score = 0
    results = {}
    
    for question in questions:
        max_score += question["points"]
        question_id = question["id"]
        student_answer = submission.answers.get(question_id, "")
        correct_answer = question["correct_answer"]
        
        is_correct = False
        if question["question_type"] == "objective":
            is_correct = student_answer.strip().lower() == correct_answer.strip().lower()
        else:  # theory questions - basic keyword matching
            is_correct = len(student_answer.strip()) > 0  # At least attempted
        
        if is_correct:
            score += question["points"]
        
        results[question_id] = {
            "student_answer": student_answer,
            "correct_answer": correct_answer,
            "is_correct": is_correct,
            "explanation": question["explanation"],
            "question_text": question["question_text"]
        }
    
    # Update attempt
    time_taken = int((datetime.utcnow() - datetime.fromisoformat(attempt["started_at"].replace('Z', '+00:00'))).total_seconds())
    
    await db.quiz_attempts.update_one(
        {"id": attempt["id"]},
        {
            "$set": {
                "answers": submission.answers,
                "score": score,
                "max_score": max_score,
                "submitted_at": datetime.utcnow(),
                "time_taken": time_taken
            }
        }
    )
    
    return {
        "score": score,
        "max_score": max_score,
        "percentage": round((score / max_score) * 100, 2) if max_score > 0 else 0,
        "results": results,
        "time_taken": time_taken
    }

# Analytics Routes (Admin only)
@api_router.get("/analytics/students")
async def get_student_analytics(current_user: User = Depends(get_admin_user)):
    total_students = await db.users.count_documents({"role": "student"})
    
    # Get recent logins (students who have taken quizzes recently)
    recent_attempts = await db.quiz_attempts.find().sort("started_at", -1).limit(50).to_list(50)
    
    students_data = []
    for attempt in recent_attempts:
        student = await db.users.find_one({"id": attempt["student_id"]})
        if student:
            quiz = await db.quizzes.find_one({"id": attempt["quiz_id"]})
            students_data.append({
                "student_name": student["username"],
                "quiz_title": quiz["title"] if quiz else "Unknown Quiz",
                "score": attempt.get("score", 0),
                "max_score": attempt.get("max_score", 0),
                "started_at": attempt["started_at"],
                "submitted_at": attempt.get("submitted_at")
            })
    
    return {
        "total_students": total_students,
        "recent_activity": students_data
    }

@api_router.get("/analytics/quizzes")
async def get_quiz_analytics(current_user: User = Depends(get_admin_user)):
    quizzes = await db.quizzes.find().to_list(1000)
    
    quiz_stats = []
    for quiz in quizzes:
        attempts = await db.quiz_attempts.find({"quiz_id": quiz["id"]}).to_list(1000)
        
        total_attempts = len(attempts)
        completed = len([a for a in attempts if a.get("submitted_at")])
        avg_score = 0
        
        if completed > 0:
            scores = [a.get("score", 0) for a in attempts if a.get("score") is not None]
            avg_score = sum(scores) / len(scores) if scores else 0
        
        quiz_stats.append({
            "quiz_title": quiz["title"],
            "total_attempts": total_attempts,
            "completed_attempts": completed,
            "average_score": round(avg_score, 2)
        })
    
    return quiz_stats

# Initialize admin user
@api_router.post("/init-admin")
async def init_admin():
    existing_admin = await db.users.find_one({"role": "admin"})
    if existing_admin:
        return {"message": "Admin already exists"}
    
    admin_user = User(
        username="admin",
        email="admin@exam.com",
        password=hash_password("admin123"),
        role=UserRole.ADMIN
    )
    
    await db.users.insert_one(admin_user.dict())
    return {"message": "Admin user created", "username": "admin", "password": "admin123"}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
