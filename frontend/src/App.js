import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Set up axios interceptor for auth tokens
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

function App() {
  const [user, setUser] = useState(null);
  const [currentView, setCurrentView] = useState('login');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is logged in
    const token = localStorage.getItem('token');
    if (token) {
      checkAuth();
    } else {
      setLoading(false);
    }
  }, []);

  const checkAuth = async () => {
    try {
      const response = await axios.get(`${API}/me`);
      setUser(response.data);
      setCurrentView(response.data.role === 'admin' ? 'admin-dashboard' : 'student-dashboard');
    } catch (error) {
      localStorage.removeItem('token');
    }
    setLoading(false);
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setCurrentView('login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-blue-600 text-white p-4">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold">ExamPlatform</h1>
          {user && (
            <div className="flex items-center space-x-4">
              <span>Welcome, {user.username} ({user.role})</span>
              <button
                onClick={logout}
                className="bg-red-500 hover:bg-red-600 px-4 py-2 rounded"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </nav>

      <div className="container mx-auto p-4">
        {currentView === 'login' && <LoginForm setUser={setUser} setCurrentView={setCurrentView} />}
        {currentView === 'register' && <RegisterForm setCurrentView={setCurrentView} />}
        {currentView === 'admin-dashboard' && <AdminDashboard setCurrentView={setCurrentView} />}
        {currentView === 'student-dashboard' && <StudentDashboard setCurrentView={setCurrentView} />}
        {currentView === 'take-quiz' && <TakeQuiz setCurrentView={setCurrentView} />}
        {currentView === 'create-question' && <CreateQuestion setCurrentView={setCurrentView} />}
        {currentView === 'create-quiz' && <CreateQuiz setCurrentView={setCurrentView} />}
        {currentView === 'analytics' && <Analytics setCurrentView={setCurrentView} />}
      </div>
    </div>
  );
}

// Login Component
function LoginForm({ setUser, setCurrentView }) {
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post(`${API}/login`, formData);
      localStorage.setItem('token', response.data.access_token);
      setUser(response.data.user);
      setCurrentView(response.data.user.role === 'admin' ? 'admin-dashboard' : 'student-dashboard');
    } catch (error) {
      setError('Invalid credentials');
    }
  };

  const initAdmin = async () => {
    try {
      await axios.post(`${API}/init-admin`);
      alert('Admin user created! Username: admin, Password: admin123');
    } catch (error) {
      alert('Admin user already exists or error occurred');
    }
  };

  return (
    <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-6 mt-10">
      <h2 className="text-2xl font-bold mb-6 text-center">Login</h2>
      {error && <div className="text-red-500 mb-4">{error}</div>}
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="block text-gray-700 mb-2">Username</label>
          <input
            type="text"
            className="w-full p-3 border rounded"
            value={formData.username}
            onChange={(e) => setFormData({...formData, username: e.target.value})}
            required
          />
        </div>
        <div className="mb-6">
          <label className="block text-gray-700 mb-2">Password</label>
          <input
            type="password"
            className="w-full p-3 border rounded"
            value={formData.password}
            onChange={(e) => setFormData({...formData, password: e.target.value})}
            required
          />
        </div>
        <button
          type="submit"
          className="w-full bg-blue-600 text-white p-3 rounded hover:bg-blue-700"
        >
          Login
        </button>
      </form>
      <div className="mt-4 text-center">
        <button
          onClick={() => setCurrentView('register')}
          className="text-blue-600 hover:underline"
        >
          Don't have an account? Register
        </button>
      </div>
      <div className="mt-4 text-center">
        <button
          onClick={initAdmin}
          className="text-sm bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
        >
          Initialize Admin User
        </button>
      </div>
    </div>
  );
}

// Register Component
function RegisterForm({ setCurrentView }) {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    role: 'student'
  });
  const [message, setMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/register`, formData);
      setMessage('Registration successful! Please login.');
      setTimeout(() => setCurrentView('login'), 2000);
    } catch (error) {
      setMessage('Registration failed: ' + (error.response?.data?.detail || 'Unknown error'));
    }
  };

  return (
    <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-6 mt-10">
      <h2 className="text-2xl font-bold mb-6 text-center">Register</h2>
      {message && <div className="mb-4 text-center text-green-600">{message}</div>}
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="block text-gray-700 mb-2">Username</label>
          <input
            type="text"
            className="w-full p-3 border rounded"
            value={formData.username}
            onChange={(e) => setFormData({...formData, username: e.target.value})}
            required
          />
        </div>
        <div className="mb-4">
          <label className="block text-gray-700 mb-2">Email</label>
          <input
            type="email"
            className="w-full p-3 border rounded"
            value={formData.email}
            onChange={(e) => setFormData({...formData, email: e.target.value})}
            required
          />
        </div>
        <div className="mb-4">
          <label className="block text-gray-700 mb-2">Password</label>
          <input
            type="password"
            className="w-full p-3 border rounded"
            value={formData.password}
            onChange={(e) => setFormData({...formData, password: e.target.value})}
            required
          />
        </div>
        <div className="mb-6">
          <label className="block text-gray-700 mb-2">Role</label>
          <select
            className="w-full p-3 border rounded"
            value={formData.role}
            onChange={(e) => setFormData({...formData, role: e.target.value})}
          >
            <option value="student">Student</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <button
          type="submit"
          className="w-full bg-green-600 text-white p-3 rounded hover:bg-green-700"
        >
          Register
        </button>
      </form>
      <div className="mt-4 text-center">
        <button
          onClick={() => setCurrentView('login')}
          className="text-blue-600 hover:underline"
        >
          Already have an account? Login
        </button>
      </div>
    </div>
  );
}

// Admin Dashboard
function AdminDashboard({ setCurrentView }) {
  const [stats, setStats] = useState({ totalQuestions: 0, totalQuizzes: 0, totalStudents: 0 });

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const [questionsRes, quizzesRes, studentsRes] = await Promise.all([
        axios.get(`${API}/questions`),
        axios.get(`${API}/quizzes`),
        axios.get(`${API}/analytics/students`)
      ]);
      
      setStats({
        totalQuestions: questionsRes.data.length,
        totalQuizzes: quizzesRes.data.length,
        totalStudents: studentsRes.data.total_students
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  return (
    <div>
      <h2 className="text-3xl font-bold mb-6">Admin Dashboard</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-md text-center">
          <h3 className="text-xl font-semibold text-gray-600">Total Questions</h3>
          <p className="text-3xl font-bold text-blue-600">{stats.totalQuestions}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md text-center">
          <h3 className="text-xl font-semibold text-gray-600">Total Quizzes</h3>
          <p className="text-3xl font-bold text-green-600">{stats.totalQuizzes}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md text-center">
          <h3 className="text-xl font-semibold text-gray-600">Total Students</h3>
          <p className="text-3xl font-bold text-purple-600">{stats.totalStudents}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          onClick={() => setCurrentView('create-question')}
          className="bg-blue-600 text-white p-4 rounded-lg hover:bg-blue-700 transition"
        >
          <h3 className="text-lg font-semibold">Create Question</h3>
          <p>Add new questions to the system</p>
        </button>
        
        <button
          onClick={() => setCurrentView('create-quiz')}
          className="bg-green-600 text-white p-4 rounded-lg hover:bg-green-700 transition"
        >
          <h3 className="text-lg font-semibold">Create Quiz</h3>
          <p>Create new quizzes from questions</p>
        </button>
        
        <button
          onClick={() => setCurrentView('analytics')}
          className="bg-purple-600 text-white p-4 rounded-lg hover:bg-purple-700 transition"
        >
          <h3 className="text-lg font-semibold">View Analytics</h3>
          <p>Student performance and activity</p>
        </button>
        
        <button
          onClick={() => setCurrentView('student-dashboard')}
          className="bg-orange-600 text-white p-4 rounded-lg hover:bg-orange-700 transition"
        >
          <h3 className="text-lg font-semibold">Student View</h3>
          <p>See the student interface</p>
        </button>
      </div>
    </div>
  );
}

// Student Dashboard
function StudentDashboard({ setCurrentView }) {
  const [quizzes, setQuizzes] = useState([]);

  useEffect(() => {
    loadQuizzes();
  }, []);

  const loadQuizzes = async () => {
    try {
      const response = await axios.get(`${API}/quizzes`);
      setQuizzes(response.data);
    } catch (error) {
      console.error('Error loading quizzes:', error);
    }
  };

  return (
    <div>
      <h2 className="text-3xl font-bold mb-6">Available Quizzes</h2>
      
      {quizzes.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-600">No quizzes available at the moment.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {quizzes.map((quiz) => (
            <div key={quiz.id} className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-xl font-semibold mb-2">{quiz.title}</h3>
              <p className="text-gray-600 mb-4">{quiz.description}</p>
              <div className="text-sm text-gray-500 mb-4">
                <p>Questions: {quiz.questions.length}</p>
                <p>Time Limit: {quiz.time_limit} minutes</p>
              </div>
              <button
                onClick={() => {
                  window.currentQuizId = quiz.id;
                  setCurrentView('take-quiz');
                }}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700"
              >
                Start Quiz
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Take Quiz Component
function TakeQuiz({ setCurrentView }) {
  const [quiz, setQuiz] = useState(null);
  const [answers, setAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [quizStarted, setQuizStarted] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    loadQuiz();
  }, []);

  useEffect(() => {
    let timer;
    if (quizStarted && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            submitQuiz();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [quizStarted, timeLeft]);

  const loadQuiz = async () => {
    try {
      const response = await axios.get(`${API}/quizzes/${window.currentQuizId}`);
      setQuiz(response.data);
    } catch (error) {
      console.error('Error loading quiz:', error);
    }
  };

  const startQuiz = async () => {
    try {
      await axios.post(`${API}/quizzes/${window.currentQuizId}/start`);
      setTimeLeft(quiz.time_limit * 60); // Convert minutes to seconds
      setQuizStarted(true);
    } catch (error) {
      alert('Error starting quiz: ' + (error.response?.data?.detail || 'Unknown error'));
    }
  };

  const submitQuiz = async () => {
    try {
      const response = await axios.post(`${API}/quizzes/${window.currentQuizId}/submit`, {
        quiz_id: window.currentQuizId,
        answers
      });
      setResult(response.data);
      setQuizStarted(false);
    } catch (error) {
      alert('Error submitting quiz: ' + (error.response?.data?.detail || 'Unknown error'));
    }
  };

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  if (!quiz) {
    return <div className="text-center">Loading quiz...</div>;
  }

  if (result) {
    return (
      <div className="max-w-4xl mx-auto">
        <h2 className="text-3xl font-bold mb-6">Quiz Results</h2>
        
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="text-center mb-6">
            <h3 className="text-2xl font-semibold">Your Score</h3>
            <p className="text-4xl font-bold text-blue-600">
              {result.score} / {result.max_score} ({result.percentage}%)
            </p>
            <p className="text-gray-600">Time taken: {Math.floor(result.time_taken / 60)} minutes</p>
          </div>
        </div>

        <div className="space-y-6">
          <h3 className="text-xl font-semibold">Question Review</h3>
          {Object.entries(result.results).map(([questionId, questionResult], index) => (
            <div key={questionId} className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-start justify-between mb-4">
                <h4 className="text-lg font-semibold">Question {index + 1}</h4>
                <span className={`px-3 py-1 rounded text-sm ${
                  questionResult.is_correct ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {questionResult.is_correct ? 'Correct' : 'Incorrect'}
                </span>
              </div>
              
              <p className="mb-4">{questionResult.question_text}</p>
              
              <div className="space-y-2">
                <div>
                  <span className="font-semibold">Your Answer: </span>
                  <span className={questionResult.is_correct ? 'text-green-600' : 'text-red-600'}>
                    {questionResult.student_answer || 'No answer'}
                  </span>
                </div>
                
                {!questionResult.is_correct && (
                  <div>
                    <span className="font-semibold">Correct Answer: </span>
                    <span className="text-green-600">{questionResult.correct_answer}</span>
                  </div>
                )}
                
                {questionResult.explanation && (
                  <div className="mt-3 p-3 bg-blue-50 rounded">
                    <span className="font-semibold">Explanation: </span>
                    {questionResult.explanation}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 text-center">
          <button
            onClick={() => setCurrentView('student-dashboard')}
            className="bg-blue-600 text-white px-6 py-3 rounded hover:bg-blue-700"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!quizStarted) {
    return (
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold mb-4">{quiz.title}</h2>
        <p className="text-gray-600 mb-4">{quiz.description}</p>
        
        <div className="mb-6">
          <p><strong>Number of Questions:</strong> {quiz.questions.length}</p>
          <p><strong>Time Limit:</strong> {quiz.time_limit} minutes</p>
        </div>
        
        <div className="flex space-x-4">
          <button
            onClick={startQuiz}
            className="bg-green-600 text-white px-6 py-3 rounded hover:bg-green-700"
          >
            Start Quiz
          </button>
          <button
            onClick={() => setCurrentView('student-dashboard')}
            className="bg-gray-500 text-white px-6 py-3 rounded hover:bg-gray-600"
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">{quiz.title}</h2>
          <div className="text-xl font-bold text-red-600">
            Time Left: {formatTime(timeLeft)}
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {quiz.question_details.map((question, index) => (
          <div key={question.id} className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold mb-4">
              Question {index + 1}: {question.question_text}
            </h3>
            
            {question.question_type === 'objective' ? (
              <div className="space-y-2">
                {question.options.map((option, optionIndex) => (
                  <label key={optionIndex} className="flex items-center space-x-3">
                    <input
                      type="radio"
                      name={question.id}
                      value={option}
                      checked={answers[question.id] === option}
                      onChange={(e) => setAnswers({...answers, [question.id]: e.target.value})}
                      className="form-radio"
                    />
                    <span>{option}</span>
                  </label>
                ))}
              </div>
            ) : (
              <textarea
                className="w-full p-3 border rounded"
                rows="4"
                placeholder="Enter your answer here..."
                value={answers[question.id] || ''}
                onChange={(e) => setAnswers({...answers, [question.id]: e.target.value})}
              />
            )}
          </div>
        ))}
      </div>

      <div className="mt-6 text-center">
        <button
          onClick={submitQuiz}
          className="bg-blue-600 text-white px-8 py-3 rounded hover:bg-blue-700"
        >
          Submit Quiz
        </button>
      </div>
    </div>
  );
}

// Create Question Component
function CreateQuestion({ setCurrentView }) {
  const [formData, setFormData] = useState({
    question_text: '',
    question_type: 'objective',
    options: ['', '', '', ''],
    correct_answer: '',
    explanation: '',
    points: 1
  });
  const [message, setMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const questionData = { ...formData };
      if (questionData.question_type === 'theory') {
        questionData.options = null;
      }
      
      await axios.post(`${API}/questions`, questionData);
      setMessage('Question created successfully!');
      setFormData({
        question_text: '',
        question_type: 'objective',
        options: ['', '', '', ''],
        correct_answer: '',
        explanation: '',
        points: 1
      });
    } catch (error) {
      setMessage('Error creating question: ' + (error.response?.data?.detail || 'Unknown error'));
    }
  };

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-md p-6">
      <h2 className="text-2xl font-bold mb-6">Create Question</h2>
      
      {message && (
        <div className="mb-4 p-3 bg-blue-100 border border-blue-400 text-blue-700 rounded">
          {message}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="block text-gray-700 mb-2">Question Text</label>
          <textarea
            className="w-full p-3 border rounded"
            rows="3"
            value={formData.question_text}
            onChange={(e) => setFormData({...formData, question_text: e.target.value})}
            required
          />
        </div>

        <div className="mb-4">
          <label className="block text-gray-700 mb-2">Question Type</label>
          <select
            className="w-full p-3 border rounded"
            value={formData.question_type}
            onChange={(e) => setFormData({...formData, question_type: e.target.value})}
          >
            <option value="objective">Multiple Choice (Objective)</option>
            <option value="theory">Essay/Text (Theory)</option>
          </select>
        </div>

        {formData.question_type === 'objective' && (
          <div className="mb-4">
            <label className="block text-gray-700 mb-2">Options</label>
            {formData.options.map((option, index) => (
              <input
                key={index}
                type="text"
                className="w-full p-3 border rounded mb-2"
                placeholder={`Option ${String.fromCharCode(65 + index)}`}
                value={option}
                onChange={(e) => {
                  const newOptions = [...formData.options];
                  newOptions[index] = e.target.value;
                  setFormData({...formData, options: newOptions});
                }}
                required
              />
            ))}
          </div>
        )}

        <div className="mb-4">
          <label className="block text-gray-700 mb-2">Correct Answer</label>
          <input
            type="text"
            className="w-full p-3 border rounded"
            value={formData.correct_answer}
            onChange={(e) => setFormData({...formData, correct_answer: e.target.value})}
            placeholder={formData.question_type === 'objective' ? 'Enter the correct option' : 'Enter model answer or keywords'}
            required
          />
        </div>

        <div className="mb-4">
          <label className="block text-gray-700 mb-2">Explanation</label>
          <textarea
            className="w-full p-3 border rounded"
            rows="3"
            value={formData.explanation}
            onChange={(e) => setFormData({...formData, explanation: e.target.value})}
            placeholder="Explain why this is the correct answer"
            required
          />
        </div>

        <div className="mb-6">
          <label className="block text-gray-700 mb-2">Points</label>
          <input
            type="number"
            className="w-full p-3 border rounded"
            min="1"
            value={formData.points}
            onChange={(e) => setFormData({...formData, points: parseInt(e.target.value)})}
            required
          />
        </div>

        <div className="flex space-x-4">
          <button
            type="submit"
            className="flex-1 bg-blue-600 text-white p-3 rounded hover:bg-blue-700"
          >
            Create Question
          </button>
          <button
            type="button"
            onClick={() => setCurrentView('admin-dashboard')}
            className="flex-1 bg-gray-500 text-white p-3 rounded hover:bg-gray-600"
          >
            Back to Dashboard
          </button>
        </div>
      </form>
    </div>
  );
}

// Create Quiz Component
function CreateQuiz({ setCurrentView }) {
  const [questions, setQuestions] = useState([]);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    questions: [],
    time_limit: 30
  });
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadQuestions();
  }, []);

  const loadQuestions = async () => {
    try {
      const response = await axios.get(`${API}/questions`);
      setQuestions(response.data);
    } catch (error) {
      console.error('Error loading questions:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/quizzes`, formData);
      setMessage('Quiz created successfully!');
      setFormData({
        title: '',
        description: '',
        questions: [],
        time_limit: 30
      });
    } catch (error) {
      setMessage('Error creating quiz: ' + (error.response?.data?.detail || 'Unknown error'));
    }
  };

  const toggleQuestion = (questionId) => {
    const isSelected = formData.questions.includes(questionId);
    if (isSelected) {
      setFormData({
        ...formData,
        questions: formData.questions.filter(id => id !== questionId)
      });
    } else {
      setFormData({
        ...formData,
        questions: [...formData.questions, questionId]
      });
    }
  };

  return (
    <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-md p-6">
      <h2 className="text-2xl font-bold mb-6">Create Quiz</h2>
      
      {message && (
        <div className="mb-4 p-3 bg-blue-100 border border-blue-400 text-blue-700 rounded">
          {message}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="block text-gray-700 mb-2">Quiz Title</label>
          <input
            type="text"
            className="w-full p-3 border rounded"
            value={formData.title}
            onChange={(e) => setFormData({...formData, title: e.target.value})}
            required
          />
        </div>

        <div className="mb-4">
          <label className="block text-gray-700 mb-2">Description</label>
          <textarea
            className="w-full p-3 border rounded"
            rows="3"
            value={formData.description}
            onChange={(e) => setFormData({...formData, description: e.target.value})}
            required
          />
        </div>

        <div className="mb-4">
          <label className="block text-gray-700 mb-2">Time Limit (minutes)</label>
          <input
            type="number"
            className="w-full p-3 border rounded"
            min="1"
            value={formData.time_limit}
            onChange={(e) => setFormData({...formData, time_limit: parseInt(e.target.value)})}
            required
          />
        </div>

        <div className="mb-6">
          <label className="block text-gray-700 mb-2">
            Select Questions ({formData.questions.length} selected)
          </label>
          <div className="max-h-64 overflow-y-auto border rounded p-4">
            {questions.length === 0 ? (
              <p className="text-gray-500">No questions available. Create questions first.</p>
            ) : (
              questions.map((question) => (
                <div key={question.id} className="flex items-center space-x-3 mb-3 p-2 border-b">
                  <input
                    type="checkbox"
                    checked={formData.questions.includes(question.id)}
                    onChange={() => toggleQuestion(question.id)}
                    className="form-checkbox"
                  />
                  <div className="flex-1">
                    <p className="font-medium">{question.question_text}</p>
                    <p className="text-sm text-gray-500">
                      Type: {question.question_type} | Points: {question.points}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="flex space-x-4">
          <button
            type="submit"
            className="flex-1 bg-blue-600 text-white p-3 rounded hover:bg-blue-700"
            disabled={formData.questions.length === 0}
          >
            Create Quiz
          </button>
          <button
            type="button"
            onClick={() => setCurrentView('admin-dashboard')}
            className="flex-1 bg-gray-500 text-white p-3 rounded hover:bg-gray-600"
          >
            Back to Dashboard
          </button>
        </div>
      </form>
    </div>
  );
}

// Analytics Component
function Analytics({ setCurrentView }) {
  const [studentAnalytics, setStudentAnalytics] = useState(null);
  const [quizAnalytics, setQuizAnalytics] = useState([]);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      const [studentsRes, quizzesRes] = await Promise.all([
        axios.get(`${API}/analytics/students`),
        axios.get(`${API}/analytics/quizzes`)
      ]);
      
      setStudentAnalytics(studentsRes.data);
      setQuizAnalytics(quizzesRes.data);
    } catch (error) {
      console.error('Error loading analytics:', error);
    }
  };

  if (!studentAnalytics) {
    return <div className="text-center">Loading analytics...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold">Analytics Dashboard</h2>
        <button
          onClick={() => setCurrentView('admin-dashboard')}
          className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
        >
          Back to Dashboard
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Student Analytics */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-xl font-semibold mb-4">Student Activity</h3>
          <div className="mb-4">
            <p className="text-2xl font-bold text-blue-600">{studentAnalytics.total_students}</p>
            <p className="text-gray-600">Total Registered Students</p>
          </div>
          
          <h4 className="font-semibold mb-3">Recent Quiz Attempts</h4>
          <div className="max-h-64 overflow-y-auto">
            {studentAnalytics.recent_activity.length === 0 ? (
              <p className="text-gray-500">No recent activity</p>
            ) : (
              studentAnalytics.recent_activity.map((activity, index) => (
                <div key={index} className="border-b py-2">
                  <p className="font-medium">{activity.student_name}</p>
                  <p className="text-sm text-gray-600">
                    {activity.quiz_title} - Score: {activity.score}/{activity.max_score}
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Date(activity.started_at).toLocaleDateString()}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Quiz Analytics */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-xl font-semibold mb-4">Quiz Performance</h3>
          <div className="space-y-4">
            {quizAnalytics.length === 0 ? (
              <p className="text-gray-500">No quiz data available</p>
            ) : (
              quizAnalytics.map((quiz, index) => (
                <div key={index} className="border rounded p-4">
                  <h4 className="font-semibold">{quiz.quiz_title}</h4>
                  <div className="grid grid-cols-3 gap-4 mt-2 text-sm">
                    <div>
                      <p className="font-medium text-blue-600">{quiz.total_attempts}</p>
                      <p className="text-gray-600">Total Attempts</p>
                    </div>
                    <div>
                      <p className="font-medium text-green-600">{quiz.completed_attempts}</p>
                      <p className="text-gray-600">Completed</p>
                    </div>
                    <div>
                      <p className="font-medium text-purple-600">{quiz.average_score}</p>
                      <p className="text-gray-600">Avg Score</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
