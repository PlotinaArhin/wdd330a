import requests
import sys
import uuid
import time
from datetime import datetime

class ExamPlatformTester:
    def __init__(self, base_url):
        self.base_url = base_url
        self.admin_token = None
        self.student_token = None
        self.admin_user = None
        self.student_user = None
        self.created_question_ids = []
        self.created_quiz_id = None
        self.tests_run = 0
        self.tests_passed = 0

    def run_test(self, name, method, endpoint, expected_status, data=None, token=None, print_response=False):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if token:
            headers['Authorization'] = f'Bearer {token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)
            
            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                if print_response and response.content:
                    try:
                        print(f"Response: {response.json()}")
                    except:
                        print(f"Response: {response.text}")
                return success, response.json() if response.content else {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                if response.content:
                    try:
                        print(f"Error: {response.json()}")
                    except:
                        print(f"Error: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_frontend_access(self):
        """Test if frontend is accessible"""
        try:
            response = requests.get(self.base_url)
            if response.status_code == 200:
                print("✅ Frontend is accessible")
                return True
            else:
                print(f"❌ Frontend returned status code {response.status_code}")
                return False
        except Exception as e:
            print(f"❌ Failed to access frontend: {str(e)}")
            return False

    def test_backend_access(self):
        """Test if backend API is accessible"""
        try:
            response = requests.get(f"{self.base_url}/api")
            if response.status_code in [200, 404]:  # 404 is acceptable as the root endpoint might not exist
                print("✅ Backend API is accessible")
                return True
            else:
                print(f"❌ Backend API returned status code {response.status_code}")
                return False
        except Exception as e:
            print(f"❌ Failed to access backend API: {str(e)}")
            return False

    def init_admin(self):
        """Initialize admin user"""
        success, response = self.run_test(
            "Initialize Admin User",
            "POST",
            "api/init-admin",
            200
        )
        return success

    def login_admin(self):
        """Login as admin"""
        success, response = self.run_test(
            "Admin Login",
            "POST",
            "api/login",
            200,
            data={"username": "admin", "password": "admin123"}
        )
        if success and 'access_token' in response:
            self.admin_token = response['access_token']
            self.admin_user = response['user']
            return True
        return False

    def register_student(self):
        """Register a student user"""
        student_id = f"student_{uuid.uuid4().hex[:8]}"
        success, response = self.run_test(
            "Register Student",
            "POST",
            "api/register",
            200,
            data={
                "username": student_id,
                "email": f"{student_id}@example.com",
                "password": "Password123!",
                "role": "student"
            }
        )
        if success and 'access_token' in response:
            self.student_token = response['access_token']
            self.student_user = response['user']
            return True
        return False

    def get_current_user(self, token, role):
        """Test getting current user info"""
        success, response = self.run_test(
            f"Get Current {role.capitalize()} User",
            "GET",
            "api/me",
            200,
            token=token
        )
        return success

    def create_objective_question(self):
        """Create an objective question"""
        success, response = self.run_test(
            "Create Objective Question",
            "POST",
            "api/questions",
            200,
            data={
                "question_text": "What is 2 + 2?",
                "question_type": "objective",
                "options": ["3", "4", "5", "6"],
                "correct_answer": "4",
                "explanation": "Basic addition",
                "points": 1
            },
            token=self.admin_token
        )
        if success and 'id' in response:
            self.created_question_ids.append(response['id'])
            return True
        return False

    def create_theory_question(self):
        """Create a theory question"""
        success, response = self.run_test(
            "Create Theory Question",
            "POST",
            "api/questions",
            200,
            data={
                "question_text": "Explain the concept of API testing.",
                "question_type": "theory",
                "correct_answer": "API testing involves testing the application programming interfaces directly",
                "explanation": "API testing is a type of software testing that involves testing APIs directly",
                "points": 5
            },
            token=self.admin_token
        )
        if success and 'id' in response:
            self.created_question_ids.append(response['id'])
            return True
        return False

    def get_questions(self):
        """Get all questions"""
        success, response = self.run_test(
            "Get Questions",
            "GET",
            "api/questions",
            200,
            token=self.admin_token,
            print_response=True
        )
        return success

    def create_quiz(self):
        """Create a quiz"""
        if not self.created_question_ids:
            print("❌ No questions available to create quiz")
            return False
            
        success, response = self.run_test(
            "Create Quiz",
            "POST",
            "api/quizzes",
            200,
            data={
                "title": "Test Quiz",
                "description": "A test quiz for API testing",
                "questions": self.created_question_ids,
                "time_limit": 10
            },
            token=self.admin_token
        )
        if success and 'id' in response:
            self.created_quiz_id = response['id']
            return True
        return False

    def get_quizzes(self, token):
        """Get all quizzes"""
        role = "admin" if token == self.admin_token else "student"
        success, response = self.run_test(
            f"Get Quizzes ({role})",
            "GET",
            "api/quizzes",
            200,
            token=token
        )
        return success

    def get_quiz_details(self, token):
        """Get quiz details"""
        if not self.created_quiz_id:
            print("❌ No quiz available to get details")
            return False
            
        role = "admin" if token == self.admin_token else "student"
        success, response = self.run_test(
            f"Get Quiz Details ({role})",
            "GET",
            f"api/quizzes/{self.created_quiz_id}",
            200,
            token=token,
            print_response=True
        )
        return success

    def start_quiz(self):
        """Start a quiz as student"""
        if not self.created_quiz_id:
            print("❌ No quiz available to start")
            return False
            
        success, response = self.run_test(
            "Start Quiz",
            "POST",
            f"api/quizzes/{self.created_quiz_id}/start",
            200,
            token=self.student_token
        )
        return success

    def submit_quiz(self):
        """Submit quiz answers"""
        if not self.created_quiz_id:
            print("❌ No quiz available to submit")
            return False
            
        # Create answers for all questions
        answers = {}
        for question_id in self.created_question_ids:
            answers[question_id] = "4"  # For objective question
            
        success, response = self.run_test(
            "Submit Quiz",
            "POST",
            f"api/quizzes/{self.created_quiz_id}/submit",
            200,
            data={
                "quiz_id": self.created_quiz_id,
                "answers": answers
            },
            token=self.student_token,
            print_response=True
        )
        return success

    def get_student_analytics(self):
        """Get student analytics"""
        success, response = self.run_test(
            "Get Student Analytics",
            "GET",
            "api/analytics/students",
            200,
            token=self.admin_token,
            print_response=True
        )
        return success

    def get_quiz_analytics(self):
        """Get quiz analytics"""
        success, response = self.run_test(
            "Get Quiz Analytics",
            "GET",
            "api/analytics/quizzes",
            200,
            token=self.admin_token,
            print_response=True
        )
        return success

    def run_all_tests(self):
        """Run all tests in sequence"""
        print("🚀 Starting Exam Platform API Tests")
        
        # Test frontend and backend access
        if not self.test_frontend_access() or not self.test_backend_access():
            print("❌ Basic access tests failed, stopping tests")
            return False
        
        # Initialize admin user
        if not self.init_admin():
            print("❌ Failed to initialize admin user, stopping tests")
            return False
            
        # Login as admin
        if not self.login_admin():
            print("❌ Admin login failed, stopping tests")
            return False
            
        # Get admin user info
        if not self.get_current_user(self.admin_token, "admin"):
            print("❌ Failed to get admin user info")
            
        # Register a student
        if not self.register_student():
            print("❌ Student registration failed, stopping tests")
            return False
            
        # Get student user info
        if not self.get_current_user(self.student_token, "student"):
            print("❌ Failed to get student user info")
            
        # Create questions
        if not self.create_objective_question():
            print("❌ Failed to create objective question")
            
        if not self.create_theory_question():
            print("❌ Failed to create theory question")
            
        # Get all questions
        if not self.get_questions():
            print("❌ Failed to get questions")
            
        # Create a quiz
        if not self.create_quiz():
            print("❌ Failed to create quiz")
            
        # Get quizzes (admin)
        if not self.get_quizzes(self.admin_token):
            print("❌ Failed to get quizzes (admin)")
            
        # Get quizzes (student)
        if not self.get_quizzes(self.student_token):
            print("❌ Failed to get quizzes (student)")
            
        # Get quiz details (admin)
        if not self.get_quiz_details(self.admin_token):
            print("❌ Failed to get quiz details (admin)")
            
        # Get quiz details (student)
        if not self.get_quiz_details(self.student_token):
            print("❌ Failed to get quiz details (student)")
            
        # Start quiz
        if not self.start_quiz():
            print("❌ Failed to start quiz")
            
        # Submit quiz
        if not self.submit_quiz():
            print("❌ Failed to submit quiz")
            
        # Get student analytics
        if not self.get_student_analytics():
            print("❌ Failed to get student analytics")
            
        # Get quiz analytics
        if not self.get_quiz_analytics():
            print("❌ Failed to get quiz analytics")
            
        # Print results
        print(f"\n📊 Tests passed: {self.tests_passed}/{self.tests_run}")
        return self.tests_passed == self.tests_run

def main():
    # Get backend URL from frontend .env file
    backend_url = "https://a0ebf1cf-aada-4919-8b56-148d792be12b.preview.emergentagent.com"
    
    # Setup tester
    tester = ExamPlatformTester(backend_url)
    
    # Run all tests
    success = tester.run_all_tests()
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())
