"""
Motion4Good Flask Backend
Complete API for user authentication, challenges, and rep tracking
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
from pymongo import MongoClient, ASCENDING
from bson import ObjectId
from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta, UTC
from functools import wraps
import os
import json

# ============================================================================
# CONFIGURATION
# ============================================================================

# Load environment variables
def load_env():
    # Try backend/.env first, then parent directory .env
    backend_env_path = os.path.join(os.path.dirname(__file__), ".env")
    parent_env_path = os.path.join(os.path.dirname(__file__), "..", ".env")

    env_path = backend_env_path if os.path.exists(backend_env_path) else parent_env_path

    if os.path.exists(env_path):
        print(f"Loading environment from: {os.path.abspath(env_path)}")
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, value = line.split("=", 1)
                    os.environ[key.strip()] = value.strip()
    else:
        print("Warning: No .env file found")

load_env()

# JWT Configuration
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "your-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

# MongoDB Configuration
MONGODB_URI = os.getenv("MONGODB_URI")
MONGODB_DB_NAME = os.getenv("MONGODB_DB_NAME", "motion4good")

# Password hashing
import bcrypt as bcrypt_lib

def hash_password_custom(password: str) -> str:
    """Hash password using bcrypt"""
    # Truncate to 72 bytes if needed
    password_bytes = password[:72].encode('utf-8')
    salt = bcrypt_lib.gensalt()
    hashed = bcrypt_lib.hashpw(password_bytes, salt)
    return hashed.decode('utf-8')

def verify_password_custom(password: str, hashed: str) -> bool:
    """Verify password against hash"""
    password_bytes = password[:72].encode('utf-8')
    hashed_bytes = hashed.encode('utf-8')
    return bcrypt_lib.checkpw(password_bytes, hashed_bytes)

# ============================================================================
# MONGODB CONNECTION
# ============================================================================

try:
    client = MongoClient(
        MONGODB_URI,
        tls=True,
        tlsAllowInvalidCertificates=True
    )
    db = client[MONGODB_DB_NAME]
    users_collection = db['users']
    challenges_collection = db['challenges']
    coach_chats_collection = db['coach_chats']
    user_medical_info_collection = db['user_medical_info']

    # Create unique index on email
    users_collection.create_index([("email", ASCENDING)], unique=True)

    print(f"✓ Connected to MongoDB: {MONGODB_DB_NAME}")
except Exception as e:
    print(f"✗ MongoDB connection failed: {e}")
    client = None
    db = None

# ============================================================================
# FLASK APP
# ============================================================================

app = Flask(__name__)
CORS(app)

# ============================================================================
# AI INTEGRATIONS (Cerebras & Moorcheh)
# ============================================================================

# Cerebras client for AI responses
from cerebras.cloud.sdk import Cerebras

cerebras_client = Cerebras(
    api_key=os.getenv("CEREBRAS_API_KEY")
)

# Moorcheh client for RAG
from moorcheh_sdk import MoorchehClient, MoorchehError

MOORCHEH_API_KEY = os.getenv("MOORCHEH_API_KEY")
moorcheh_client = None
if MOORCHEH_API_KEY:
    try:
        moorcheh_client = MoorchehClient(api_key=MOORCHEH_API_KEY)
        print("✓ Moorcheh client initialized")
    except Exception as e:
        print(f"✗ Moorcheh initialization failed: {e}")
else:
    print("⚠ MOORCHEH_API_KEY not set - RAG features will be disabled")

# ElevenLabs client for TTS
from elevenlabs import ElevenLabs

ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")
elevenlabs_client = None
if ELEVENLABS_API_KEY:
    try:
        elevenlabs_client = ElevenLabs(api_key=ELEVENLABS_API_KEY)
        print("✓ ElevenLabs client initialized")
    except Exception as e:
        print(f"✗ ElevenLabs initialization failed: {e}")
else:
    print("⚠ ELEVENLABS_API_KEY not set - TTS features will be disabled")

# Helper function to clean reasoning tags from AI responses
def clean_reasoning_tags(text):
    """Remove <think>...</think> tags from AI responses"""
    if not text:
        return text

    import re
    # Remove <think>...</think> blocks (including multiline)
    cleaned = re.sub(r'<think>.*?</think>', '', text, flags=re.DOTALL)
    # Clean up extra whitespace
    cleaned = re.sub(r'\n\s*\n\s*\n', '\n\n', cleaned)
    return cleaned.strip()

# System prompt for the coach
COACH_SYSTEM_PROMPT = """You're texting the user as their gym coach. Text like a real person - casual, encouraging, short messages.

**Motion4Good:** Fitness challenges. Webcam counts reps in real-time. Users contribute to shared goals, earn rewards.

**Exercises:** jumping_jacks, squats, high_knees, bicep_curls, tricep_extensions, lateral_raises (last 3 need dumbbells)

**Texting Style:**
- Keep it SHORT - like actual texts (1-2 sentences max)
- Multiple short messages > one long message
- Use casual language, contractions (you're, let's, etc)
- Skip formalities - just get to the point
- Include challenge links: http://localhost:8080/challenges/{id}

**Tool:** Need data? Use: TOOL: GET_DATA
Returns all challenges and user info.

Text naturally. Don't mention the tool."""

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def serialize_doc(doc):
    """Convert MongoDB document to JSON-serializable dict"""
    if doc and '_id' in doc:
        doc['_id'] = str(doc['_id'])
    if doc and 'creatorUserId' in doc and isinstance(doc['creatorUserId'], ObjectId):
        doc['creatorUserId'] = str(doc['creatorUserId'])
    if doc and 'participants' in doc:
        doc['participants'] = [str(p) if isinstance(p, ObjectId) else p for p in doc['participants']]
    if doc and 'enrolledChallenges' in doc:
        doc['enrolledChallenges'] = [str(c) if isinstance(c, ObjectId) else c for c in doc['enrolledChallenges']]
    return doc

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password against hash"""
    return verify_password_custom(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """Hash password"""
    return hash_password_custom(password)

def create_access_token(data: dict) -> str:
    """Create JWT token"""
    to_encode = data.copy()
    expire = datetime.now(UTC) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_token_decorator(f):
    """Decorator to verify JWT token"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return jsonify({'error': 'No authorization header'}), 401

        try:
            token = auth_header.split(' ')[1] if ' ' in auth_header else auth_header
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            user_id = payload.get('sub')
            if user_id is None:
                return jsonify({'error': 'Invalid token'}), 401
            request.user_id = user_id
        except JWTError:
            return jsonify({'error': 'Invalid token'}), 401

        return f(*args, **kwargs)
    return decorated_function

# ============================================================================
# CONSULTANT HELPER FUNCTIONS
# ============================================================================

def initialize_user_namespace(user_id):
    """Create Moorcheh namespace for user if it doesn't exist"""
    if not moorcheh_client:
        return False

    namespace_name = f"user_{user_id}_context"
    try:
        moorcheh_client.namespaces.create(
            namespace_name=namespace_name,
            type="text"
        )
        return True
    except:
        # Namespace already exists
        return True

def index_chat_history(user_id, messages):
    """Upload chat history to Moorcheh for RAG"""
    if not moorcheh_client:
        return

    namespace = f"user_{user_id}_context"
    try:
        docs = [
            {
                "id": f"msg_{user_id}_{i}_{int(datetime.now(UTC).timestamp())}",
                "text": f"{msg['role']}: {msg['content']}"
            }
            for i, msg in enumerate(messages)
        ]
        if docs:
            moorcheh_client.documents.upload(namespace_name=namespace, documents=docs)
    except Exception as e:
        print(f"Failed to index chat history: {e}")

def index_medical_info(user_id, medical_info):
    """Upload medical info to Moorcheh for RAG"""
    if not moorcheh_client:
        return

    namespace = f"user_{user_id}_context"
    try:
        docs = []
        if medical_info.get('goals'):
            docs.append({"id": f"goals_{user_id}", "text": f"Fitness Goals: {medical_info['goals']}"})
        if medical_info.get('medicalHistory'):
            docs.append({"id": f"medical_{user_id}", "text": f"Medical History: {medical_info['medicalHistory']}"})
        if medical_info.get('physicalStatus'):
            docs.append({"id": f"physical_{user_id}", "text": f"Physical Status: {medical_info['physicalStatus']}"})
        if medical_info.get('concerns'):
            docs.append({"id": f"concerns_{user_id}", "text": f"Concerns: {medical_info['concerns']}"})
        if medical_info.get('dietaryRestrictions'):
            docs.append({"id": f"dietary_{user_id}", "text": f"Dietary Restrictions: {medical_info['dietaryRestrictions']}"})

        if docs:
            moorcheh_client.documents.upload(namespace_name=namespace, documents=docs)
    except Exception as e:
        print(f"Failed to index medical info: {e}")

def get_rag_context(user_id, query):
    """Get relevant context using Moorcheh RAG"""
    if not moorcheh_client:
        return ""

    namespace = f"user_{user_id}_context"
    try:
        results = moorcheh_client.similarity_search.query(
            namespaces=[namespace],
            query=query,
            top_k=5
        )
        if results and 'results' in results:
            return "\n".join([r.get('text', '') for r in results['results']])
        return ""
    except Exception as e:
        print(f"Failed to get RAG context: {e}")
        return ""

def get_tool_data(tool_name, user_id):
    """Execute tool calls and return data"""
    try:
        if tool_name == "GET_DATA":
            # Get all challenges
            all_challenges = list(challenges_collection.find({}).limit(20))
            challenges_data = []
            user_enrolled_ids = []

            for ch in all_challenges:
                ch_id = str(ch['_id'])
                is_enrolled = user_id in ch.get('participants', [])

                if is_enrolled:
                    user_enrolled_ids.append(ch_id)

                challenges_data.append({
                    "id": ch_id,
                    "name": ch['name'],
                    "description": ch['description'],
                    "exercises": ch.get('enabledExercises', []),
                    "repGoals": ch.get('repGoal', {}),
                    "completionReward": ch.get('completionReward', ''),
                    "participants": len(ch.get('participants', [])),
                    "completed": ch.get('completed', False),
                    "user_enrolled": is_enrolled,
                    "user_contributions": ch.get('contributions', {}).get(user_id, {}) if is_enrolled else {}
                })

            result = {
                "all_challenges": challenges_data,
                "user_enrolled_challenge_ids": user_enrolled_ids,
                "available_exercises": {
                    "jumping_jacks": "Full-body cardio",
                    "squats": "Lower body strength",
                    "high_knees": "Cardio endurance",
                    "bicep_curls": "Upper body (dumbbells)",
                    "tricep_extensions": "Upper arm (dumbbells)",
                    "lateral_raises": "Shoulders (dumbbells)"
                }
            }

            return json.dumps(result, indent=2)

        return ""
    except Exception as e:
        print(f"Tool execution error: {e}")
        import traceback
        traceback.print_exc()
        return ""

def get_ai_response(user_message, chat_history, rag_context, user_id, coach_settings=None, retry_count=0):
    """Get response from Cerebras GLM 4.6 with tool calling support"""
    max_retries = 5

    try:
        # Build system prompt with coach settings
        system_prompt = COACH_SYSTEM_PROMPT

        if coach_settings:
            settings_parts = []

            tone = coach_settings.get('tonePreference', 'casual')
            if tone == 'professional':
                settings_parts.append("- Use professional, formal tone")
            elif tone == 'friendly':
                settings_parts.append("- Use friendly, warm tone")
            elif tone == 'motivational':
                settings_parts.append("- Be extra motivating and energetic")

            response_length = coach_settings.get('responseLength', 'short')
            if response_length == 'very_short':
                settings_parts.append("- Keep responses VERY SHORT (1 sentence max)")
            elif response_length == 'medium':
                settings_parts.append("- Use moderate length responses (2-3 sentences)")

            motivation_level = coach_settings.get('motivationLevel', 'moderate')
            if motivation_level == 'high':
                settings_parts.append("- User wants HIGH ENERGY motivation - be super enthusiastic!")
            elif motivation_level == 'low':
                settings_parts.append("- User prefers gentle encouragement - keep it chill")

            focus_areas = coach_settings.get("focusAreas", [])
            if focus_areas:
                settings_parts.append(f"- User's focus areas: {', '.join(focus_areas)}")

            if settings_parts:
                system_prompt += "\n\n**User Preferences:**\n" + "\n".join(settings_parts)

        messages = [{"role": "system", "content": system_prompt}]

        # Add recent chat history (last 6 messages)
        recent_history = chat_history[-6:] if len(chat_history) > 6 else chat_history
        for msg in recent_history:
            if msg.get('role') in ['user', 'assistant']:
                messages.append({
                    "role": msg['role'],
                    "content": msg['content']
                })

        # Add current user message
        messages.append({"role": "user", "content": user_message})

        # First call to check if LLM needs tools
        response = cerebras_client.chat.completions.create(
            model="qwen-3-32b",
            messages=messages,
            temperature=0.8,
            max_tokens=300
        )

        ai_content = response.choices[0].message.content
        # Clean reasoning tags from response
        ai_content = clean_reasoning_tags(ai_content)
        print(f"[AI Response] Length: {len(ai_content) if ai_content else 0}, Content: {ai_content[:200] if ai_content else 'EMPTY'}")

        # If content is empty or None, retry
        if not ai_content or not ai_content.strip():
            if retry_count < max_retries:
                print(f"[Retry {retry_count + 1}/{max_retries}] Empty response, retrying...")
                import time
                time.sleep(1)  # Wait 1 second before retrying
                return get_ai_response(user_message, chat_history, rag_context, user_id, coach_settings, retry_count + 1)
            else:
                print(f"[Max Retries Reached] Giving up after {max_retries} attempts")
                return "Hey! I'm having some trouble right now. Can you try asking again?"

        # Check if response contains tool calls
        if ai_content and "TOOL:" in ai_content:
            print("[Tool Call Detected]")
            # Extract tool calls
            lines = ai_content.split('\n')
            tool_calls = []
            for line in lines:
                if line.strip().startswith("TOOL:"):
                    tool_name = line.replace("TOOL:", "").strip()
                    tool_calls.append(tool_name)

            # Execute tools and gather data
            tool_results = []
            for tool_name in tool_calls:
                print(f"[Executing Tool] {tool_name}")
                data = get_tool_data(tool_name, user_id)
                if data:
                    tool_results.append(f"{tool_name} Results:\n{data}")

            # Second call with tool results
            if tool_results:
                messages.append({"role": "assistant", "content": ai_content})
                messages.append({
                    "role": "system",
                    "content": f"Data:\n\n{chr(10).join(tool_results)}\n\nText back like a real person. 1-2 short sentences. Include challenge links."
                })

                response = cerebras_client.chat.completions.create(
                    model="qwen-3-32b",
                    messages=messages,
                    temperature=0.8,
                    max_tokens=300
                )

                ai_content = response.choices[0].message.content
                # Clean reasoning tags from response
                ai_content = clean_reasoning_tags(ai_content)
                print(f"[Final AI Response] Length: {len(ai_content) if ai_content else 0}")

                # Check if final response is empty and retry if needed
                if not ai_content or not ai_content.strip():
                    if retry_count < max_retries:
                        print(f"[Retry {retry_count + 1}/{max_retries}] Empty final response, retrying...")
                        import time
                        time.sleep(1)
                        return get_ai_response(user_message, chat_history, rag_context, user_id, coach_settings, retry_count + 1)
                    else:
                        return "Hey! I'm having some trouble right now. Can you try asking again?"

        return ai_content
    except Exception as e:
        print(f"Failed to get AI response (attempt {retry_count + 1}/{max_retries}): {e}")
        import traceback
        traceback.print_exc()

        # Retry on exception
        if retry_count < max_retries:
            print(f"[Retry {retry_count + 1}/{max_retries}] Exception occurred, retrying...")
            import time
            time.sleep(1)  # Wait 1 second before retrying
            return get_ai_response(user_message, chat_history, rag_context, user_id, coach_settings, retry_count + 1)
        else:
            print(f"[Max Retries Reached] Giving up after {max_retries} attempts")
            return "Hey! I'm having some trouble right now. Can you try asking again?"

# ============================================================================
# API ROUTES
# ============================================================================

@app.route('/', methods=['GET'])
def root():
    """API information"""
    return jsonify({
        "message": "Motion4Good API",
        "version": "1.0.0",
        "endpoints": {
            "POST /users": "Create user",
            "POST /auth/login": "Login",
            "POST /auth/logout": "Logout",
            "POST /challenges": "Create challenge",
            "DELETE /challenges/{id}": "Delete challenge",
            "GET /challenges/{id}": "Get challenge",
            "POST /challenges/{id}/enroll": "Enroll in challenge",
            "POST /challenges/{id}/unenroll": "Unenroll from challenge",
            "POST /reps/process": "Process reps",
            "POST /challenges/{id}/contributions/increment": "Increment contributions",
            "GET /challenges/{id}/contributions/{user_id}": "Get contributions"
        }
    })

# ============================================================================
# AUTH / USERS
# ============================================================================

@app.route('/users', methods=['POST'])
def create_user():
    """Create a new user"""
    try:
        data = request.json
        username = data.get('username')
        email = data.get('email')
        password = data.get('password')

        if not username or not email or not password:
            return jsonify({'error': 'Missing required fields'}), 400

        # Check if email already exists
        if users_collection.find_one({"email": email}):
            return jsonify({'error': 'Email already registered'}), 400

        # Hash password
        hashed_password = get_password_hash(password)

        # Create user document
        user_doc = {
            "username": username,
            "email": email,
            "passwordHash": hashed_password,
            "enrolledChallenges": [],
            "createdAt": datetime.now(UTC)
        }

        # Insert into database
        result = users_collection.insert_one(user_doc)

        return jsonify({'user_id': str(result.inserted_id)}), 201

    except Exception as e:
        if "duplicate key error" in str(e).lower():
            return jsonify({'error': 'Email already registered'}), 400
        return jsonify({'error': str(e)}), 500

@app.route('/auth/login', methods=['POST'])
def login():
    """Login user"""
    try:
        data = request.json
        email = data.get('email')
        password = data.get('password')

        if not email or not password:
            return jsonify({'error': 'Missing email or password'}), 400

        # Find user by email
        user = users_collection.find_one({"email": email})

        if not user:
            return jsonify({'error': 'No account found with this email'}), 401

        # Verify password
        if not verify_password(password, user["passwordHash"]):
            return jsonify({'error': 'Incorrect password'}), 401

        # Create access token
        access_token = create_access_token(data={"sub": str(user["_id"])})

        return jsonify({
            'user_id': str(user["_id"]),
            'token': access_token
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/auth/logout', methods=['POST'])
def logout():
    """Logout user (client should discard token)"""
    return jsonify({'success': True})

@app.route('/users/batch', methods=['POST'])
def get_users_batch():
    """Get user information for multiple user IDs"""
    try:
        data = request.json
        user_ids = data.get('user_ids', [])

        if not user_ids:
            return jsonify({'users': {}}), 200

        # Convert string IDs to ObjectIds
        object_ids = []
        for user_id in user_ids:
            try:
                object_ids.append(ObjectId(user_id))
            except:
                pass  # Skip invalid IDs

        # Fetch users from database
        users = users_collection.find(
            {"_id": {"$in": object_ids}},
            {"_id": 1, "username": 1, "email": 1}
        )

        # Build response dictionary
        users_dict = {}
        for user in users:
            users_dict[str(user["_id"])] = {
                "id": str(user["_id"]),
                "username": user.get("username", "Unknown"),
                "email": user.get("email", "")
            }

        return jsonify({'users': users_dict}), 200

    except Exception as e:
        print(f"✗ Error fetching users: {e}")
        return jsonify({'error': str(e)}), 500

# ============================================================================
# CHALLENGES
# ============================================================================

@app.route('/challenges', methods=['POST'])
@verify_token_decorator
def create_challenge():
    """Create a new challenge"""
    try:
        data = request.json
        user_id = request.user_id

        # Validate required fields
        required = ['name', 'description', 'enabled_exercises', 'rep_goal', 'rep_reward', 'rep_reward_type', 'completion_reward', 'start_date', 'end_date']
        if not all(field in data for field in required):
            return jsonify({'error': 'Missing required fields'}), 400

        # Validate that all rep_* keys match enabled_exercises
        enabled_set = set(data['enabled_exercises'])
        if set(data['rep_goal'].keys()) != enabled_set:
            return jsonify({'error': 'rep_goal keys must match enabled_exercises'}), 400
        if set(data['rep_reward'].keys()) != enabled_set:
            return jsonify({'error': 'rep_reward keys must match enabled_exercises'}), 400
        if set(data['rep_reward_type'].keys()) != enabled_set:
            return jsonify({'error': 'rep_reward_type keys must match enabled_exercises'}), 400

        # Create challenge document
        challenge_doc = {
            "name": data['name'],
            "description": data['description'],
            "creatorUserId": ObjectId(user_id),
            "enabledExercises": data['enabled_exercises'],
            "participants": [],
            "contributions": {},
            "repGoal": data['rep_goal'],
            "repReward": data['rep_reward'],
            "repRewardType": data['rep_reward_type'],
            "completionReward": data['completion_reward'],
            "startDate": datetime.fromisoformat(data['start_date'].replace('Z', '+00:00')),
            "endDate": datetime.fromisoformat(data['end_date'].replace('Z', '+00:00')),
            "completed": False,
            "createdAt": datetime.now(UTC)
        }

        # Insert into database
        result = challenges_collection.insert_one(challenge_doc)

        return jsonify({'challenge_id': str(result.inserted_id)}), 201

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/challenges', methods=['GET'])
def get_challenges():
    """Get all challenges"""
    print("getting challenges!")
    try:
        # Fetch all challenges from database
        challenges_cursor = challenges_collection.find({})

        print("challenges: ", challenges_cursor)

        challenges = []
        for challenge in challenges_cursor:
            # Serialize the challenge document
            challenge_dict = serialize_doc(challenge)

            # Convert dates to ISO format strings
            if 'startDate' in challenge_dict:
                challenge_dict['startDate'] = challenge['startDate'].isoformat()
            if 'endDate' in challenge_dict:
                challenge_dict['endDate'] = challenge['endDate'].isoformat()
            if 'createdAt' in challenge_dict:
                challenge_dict['createdAt'] = challenge['createdAt'].isoformat()

            challenges.append(challenge_dict)

        print(f"✓ Fetched {len(challenges)} challenges from database")
        for idx, ch in enumerate(challenges, 1):
            print(f"  {idx}. {ch['name']} (ID: {ch['_id']})")

        return jsonify({'challenges': challenges}), 200

    except Exception as e:
        print(f"✗ Error fetching challenges: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/challenges/my', methods=['GET'])
@verify_token_decorator
def get_my_challenges():
    """Get challenges for the logged-in user (created by user or enrolled in)"""
    try:
        user_id_str = request.user_id

        # Validate and convert user_id to ObjectId
        try:
            user_id = ObjectId(user_id_str)
        except:
            return jsonify({'error': 'Invalid user ID'}), 400

        # Find challenges created by user OR where user is a participant
        challenges_cursor = challenges_collection.find({
            "$or": [
                {"creatorUserId": user_id},
                {"participants": user_id_str}
            ]
        })

        challenges = []
        for challenge in challenges_cursor:
            # Serialize the challenge document
            challenge_dict = serialize_doc(challenge)

            # Convert dates to ISO format strings
            if 'startDate' in challenge_dict:
                challenge_dict['startDate'] = challenge['startDate'].isoformat()
            if 'endDate' in challenge_dict:
                challenge_dict['endDate'] = challenge['endDate'].isoformat()
            if 'createdAt' in challenge_dict:
                challenge_dict['createdAt'] = challenge['createdAt'].isoformat()

            challenges.append(challenge_dict)

        print(f"✓ Fetched {len(challenges)} challenges for user {user_id_str}")
        for idx, ch in enumerate(challenges, 1):
            print(f"  {idx}. {ch['name']} (ID: {ch['_id']})")

        return jsonify({'challenges': challenges}), 200

    except Exception as e:
        print(f"✗ Error fetching user challenges: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/challenges/enrolled', methods=['GET'])
@verify_token_decorator
def get_enrolled_challenges():
    """Get challenges where the logged-in user is enrolled (includes their own challenges if enrolled)"""
    try:
        user_id_str = request.user_id

        # Find challenges where user is a participant
        challenges_cursor = challenges_collection.find({
            "participants": user_id_str
        })

        challenges = []
        for challenge in challenges_cursor:
            # Serialize the challenge document
            challenge_dict = serialize_doc(challenge)

            # Convert dates to ISO format strings
            if 'startDate' in challenge_dict:
                challenge_dict['startDate'] = challenge['startDate'].isoformat()
            if 'endDate' in challenge_dict:
                challenge_dict['endDate'] = challenge['endDate'].isoformat()
            if 'createdAt' in challenge_dict:
                challenge_dict['createdAt'] = challenge['createdAt'].isoformat()

            challenges.append(challenge_dict)

        print(f"✓ Fetched {len(challenges)} enrolled challenges for user {user_id_str}")
        for idx, ch in enumerate(challenges, 1):
            print(f"  {idx}. {ch['name']} (ID: {ch['_id']})")

        return jsonify({'challenges': challenges}), 200

    except Exception as e:
        print(f"✗ Error fetching enrolled challenges: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/challenges/<challenge_id>', methods=['DELETE'])
@verify_token_decorator
def delete_challenge(challenge_id):
    """Delete a challenge (only creator can delete)"""
    try:
        user_id_str = request.user_id

        # Validate and convert user_id to ObjectId
        try:
            user_id = ObjectId(user_id_str)
        except:
            return jsonify({'error': 'Invalid user ID'}), 400

        challenge = challenges_collection.find_one({"_id": ObjectId(challenge_id)})

        if not challenge:
            return jsonify({'error': 'Challenge not found'}), 404

        # Only creator can delete - compare ObjectIds
        if challenge["creatorUserId"] != user_id:
            return jsonify({
                'error': 'Only creator can delete challenge',
                'challenge_id': challenge_id,
                'challenge_creator_id': str(challenge["creatorUserId"]),
                'requesting_user_id': user_id_str
            }), 403

        # Remove challenge from all enrolled users' enrolledChallenges arrays
        challenge_obj_id = ObjectId(challenge_id)
        participants = challenge.get('participants', [])

        # Convert string participants to ObjectIds for user lookup
        participant_ids = []
        for participant in participants:
            try:
                if isinstance(participant, str):
                    participant_ids.append(ObjectId(participant))
                else:
                    participant_ids.append(participant)
            except:
                continue

        # Remove challenge from all enrolled users
        if participant_ids:
            users_collection.update_many(
                {"_id": {"$in": participant_ids}},
                {"$pull": {"enrolledChallenges": challenge_obj_id}}
            )
            print(f"✓ Removed challenge {challenge_id} from {len(participant_ids)} users' enrolledChallenges")

        # Delete challenge
        challenges_collection.delete_one({"_id": challenge_obj_id})
        print(f"✓ Deleted challenge {challenge_id}")

        return jsonify({
            'success': True,
            'challenge_id': challenge_id,
            'challenge_creator_id': str(challenge["creatorUserId"]),
            'requesting_user_id': user_id_str
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/challenges/<challenge_id>', methods=['GET'])
def get_challenge(challenge_id):
    """Get full challenge information"""
    try:
        challenge = challenges_collection.find_one({"_id": ObjectId(challenge_id)})

        if not challenge:
            return jsonify({'error': 'Challenge not found'}), 404

        # Serialize the challenge document
        challenge_dict = serialize_doc(challenge)

        # Convert dates to ISO format strings
        if 'startDate' in challenge_dict:
            challenge_dict['startDate'] = challenge['startDate'].isoformat()
        if 'endDate' in challenge_dict:
            challenge_dict['endDate'] = challenge['endDate'].isoformat()
        if 'createdAt' in challenge_dict:
            challenge_dict['createdAt'] = challenge['createdAt'].isoformat()

        print(f"✓ Fetched challenge: {challenge_dict['name']} (ID: {challenge_dict['_id']})")

        return jsonify(challenge_dict)

    except Exception as e:
        print(f"✗ Error fetching challenge: {e}")
        return jsonify({'error': str(e)}), 500

# ============================================================================
# ENROLLMENT
# ============================================================================

@app.route('/challenges/<challenge_id>/enroll', methods=['POST'])
@verify_token_decorator
def enroll_in_challenge(challenge_id):
    """Enroll logged-in user in challenge"""
    try:
        # Get user_id from JWT token (authenticated user)
        user_id_str = request.user_id
        user_id = ObjectId(user_id_str)

        # Check if challenge exists
        challenge = challenges_collection.find_one({"_id": ObjectId(challenge_id)})
        if not challenge:
            return jsonify({'error': 'Challenge not found'}), 404

        # Check if user is already enrolled
        if user_id_str in challenge.get('participants', []):
            return jsonify({'error': 'User already enrolled in this challenge'}), 400

        # Add user to participants (store as string for consistency)
        challenges_collection.update_one(
            {"_id": ObjectId(challenge_id)},
            {
                "$addToSet": {"participants": user_id_str},
                "$set": {f"contributions.{user_id_str}": {}}
            }
        )

        # Add challenge to user's enrolledChallenges
        users_collection.update_one(
            {"_id": user_id},
            {"$addToSet": {"enrolledChallenges": ObjectId(challenge_id)}}
        )

        return jsonify({'success': True})

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/challenges/<challenge_id>/unenroll', methods=['POST'])
@verify_token_decorator
def unenroll_from_challenge(challenge_id):
    """Unenroll logged-in user from challenge"""
    try:
        # Get user_id from JWT token (authenticated user)
        user_id_str = request.user_id
        user_id = ObjectId(user_id_str)

        # Check if challenge exists
        challenge = challenges_collection.find_one({"_id": ObjectId(challenge_id)})
        if not challenge:
            return jsonify({'error': 'Challenge not found'}), 404

        # Check if user is enrolled in the challenge
        if user_id_str not in challenge.get('participants', []):
            return jsonify({'error': 'User not enrolled in this challenge'}), 400

        # Remove user from participants and contributions (use string for consistency)
        challenges_collection.update_one(
            {"_id": ObjectId(challenge_id)},
            {
                "$pull": {"participants": user_id_str},
                "$unset": {f"contributions.{user_id_str}": ""}
            }
        )

        # Remove challenge from user's enrolledChallenges
        users_collection.update_one(
            {"_id": user_id},
            {"$pull": {"enrolledChallenges": ObjectId(challenge_id)}}
        )

        return jsonify({'success': True})

    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ============================================================================
# REP PROCESSING
# ============================================================================

@app.route('/reps/process', methods=['GET'])
def process_reps():
    """
    Get current rep counts from rep_counter.json and reset to 0
    No authentication required
    """
    try:
        rep_file_path = os.path.join(os.path.dirname(__file__), "rep_counter.json")

        # Read current counts and immediately reset in one atomic operation
        with open(rep_file_path, 'r+') as f:
            counts = json.load(f)
            app.logger.info(f"[/reps/process] Read counts: {counts}")

            # Reset to 0
            reset_counts = {k: 0 for k in counts.keys()}
            f.seek(0)
            f.truncate()
            json.dump(reset_counts, f, indent=2)

        app.logger.info(f"[/reps/process] Returning: {counts} (file reset to 0)")

        return jsonify(counts)

    except FileNotFoundError:
        # Initialize file if it doesn't exist
        default_counts = {
            "jumping_jacks": 0,
            "squats": 0,
            "high_knees": 0,
            "bicep_curls": 0,
            "tricep_extensions": 0,
            "lateral_raises": 0
        }
        with open(rep_file_path, 'w') as f:
            json.dump(default_counts, f, indent=2)
        return jsonify(default_counts)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/target-exercise', methods=['POST'])
def set_target_exercise():
    """
    Set the target exercise for the motion detection script
    Request body: { "target": "squats" | "jumping_jacks" | "high_knees" | "bicep_curls" | "tricep_extensions" | "lateral_raises" }
    No authentication required
    """
    try:
        data = request.json
        if not data or 'target' not in data:
            return jsonify({'error': 'Missing target field'}), 400

        target = data['target']

        # Validate target exercise
        valid_exercises = ["squats", "jumping_jacks", "high_knees", "bicep_curls", "tricep_extensions", "lateral_raises"]
        if target not in valid_exercises:
            return jsonify({'error': f'Invalid target. Must be one of: {", ".join(valid_exercises)}'}), 400

        # Write to target_exercise.json
        target_file_path = os.path.join(os.path.dirname(__file__), "target_exercise.json")
        with open(target_file_path, 'w') as f:
            json.dump({"target": target}, f, indent=2)

        return jsonify({'success': True, 'target': target})

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/target-exercise', methods=['GET'])
def get_target_exercise():
    """
    Get the current target exercise
    No authentication required
    """
    try:
        target_file_path = os.path.join(os.path.dirname(__file__), "target_exercise.json")

        if not os.path.exists(target_file_path):
            # Create default file
            default_target = {"target": "squats"}
            with open(target_file_path, 'w') as f:
                json.dump(default_target, f, indent=2)
            return jsonify(default_target)

        with open(target_file_path, 'r') as f:
            target_data = json.load(f)

        return jsonify(target_data)

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/challenges/<challenge_id>/contributions/increment', methods=['POST'])
@verify_token_decorator
def increment_contributions(challenge_id):
    """Atomically increment user contributions for a challenge and check for completion"""
    try:
        # Get user_id from JWT token (authenticated user)
        user_id = request.user_id

        data = request.json
        if not data or 'increments' not in data:
            return jsonify({'error': 'increments field is required'}), 400

        increments = data['increments']

        # Get challenge to check enabled exercises
        challenge = challenges_collection.find_one({"_id": ObjectId(challenge_id)})
        if not challenge:
            return jsonify({'error': 'Challenge not found'}), 404

        enabled_exercises = challenge.get('enabledExercises', [])

        # Build atomic increment update - only for enabled exercises
        update_doc = {}
        applied_increments = {}
        ignored_exercises = {}

        for exercise, count in increments.items():
            if count > 0:  # Only increment positive values
                if exercise in enabled_exercises:
                    # Exercise is enabled for this challenge
                    update_doc[f"contributions.{user_id}.{exercise}"] = count
                    applied_increments[exercise] = count
                else:
                    # Exercise not enabled for this challenge - ignore it
                    ignored_exercises[exercise] = count
                    print(f"⚠ Ignoring {exercise} for challenge {challenge_id} - not enabled")

        if not update_doc:
            return jsonify({
                'increments': {},
                'ignored': ignored_exercises,
                'message': 'No valid exercises for this challenge'
            })

        # Atomic increment
        challenges_collection.update_one(
            {"_id": ObjectId(challenge_id)},
            {"$inc": update_doc}
        )

        print(f"✓ Incremented contributions for challenge {challenge_id}: {applied_increments}")
        if ignored_exercises:
            print(f"  Ignored exercises: {ignored_exercises}")

        # Check if challenge goals have been met (re-fetch to get updated contributions)
        challenge = challenges_collection.find_one({"_id": ObjectId(challenge_id)})
        if not challenge.get('completed', False):
            rep_goal = challenge.get('repGoal', {})
            contributions = challenge.get('contributions', {})

            # Calculate total reps for each exercise
            total_reps = {}
            for user_contributions in contributions.values():
                for exercise, reps in user_contributions.items():
                    total_reps[exercise] = total_reps.get(exercise, 0) + reps

            # Check if all exercise goals are met
            all_goals_met = True
            for exercise, goal in rep_goal.items():
                if total_reps.get(exercise, 0) < goal:
                    all_goals_met = False
                    break

            # If all goals met, mark challenge as completed
            if all_goals_met:
                challenges_collection.update_one(
                    {"_id": ObjectId(challenge_id)},
                    {"$set": {"completed": True}}
                )
                print(f"✓ Challenge {challenge_id} marked as completed! All goals met.")

        response_data = {'increments': applied_increments}
        if ignored_exercises:
            response_data['ignored'] = ignored_exercises
            response_data['message'] = f"Some exercises were not counted (not enabled for this challenge)"

        return jsonify(response_data)

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/challenges/<challenge_id>/contributions/<user_id>', methods=['GET'])
def get_contributions(challenge_id, user_id):
    """Get user contributions for a challenge"""
    try:
        challenge = challenges_collection.find_one({"_id": ObjectId(challenge_id)})

        if not challenge:
            return jsonify({'error': 'Challenge not found'}), 404

        contributions = challenge.get("contributions", {}).get(user_id, {})

        # Ensure all enabled exercises are represented
        for exercise in challenge.get("enabledExercises", []):
            if exercise not in contributions:
                contributions[exercise] = 0

        return jsonify(contributions)

    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ============================================================================
# COACH API ENDPOINTS
# ============================================================================

@app.route('/coach/chat', methods=['POST'])
@verify_token_decorator
def coach_chat():
    """Send message to coach and get AI response"""
    try:
        user_id = request.user_id
        data = request.get_json()
        user_message = data.get('message')

        if not user_message:
            return jsonify({'error': 'Message is required'}), 400

        # Initialize user's Moorcheh namespace
        initialize_user_namespace(user_id)

        # Get or create chat document
        chat = coach_chats_collection.find_one({"userId": user_id})
        if not chat:
            chat = {
                "userId": user_id,
                "messages": [],
                "createdAt": datetime.now(UTC)
            }
            result = coach_chats_collection.insert_one(chat)
            chat['_id'] = result.inserted_id

        # Get RAG context
        rag_context = get_rag_context(user_id, user_message)

        # Get user's coach settings
        user = users_collection.find_one({"_id": ObjectId(user_id)})
        coach_settings = user.get("coachSettings", {}) if user else {}

        # Get AI response
        ai_response = get_ai_response(
            user_message,
            chat.get('messages', []),
            rag_context,
            user_id,
            coach_settings
        )

        # Save messages
        new_messages = [
            {"role": "user", "content": user_message, "timestamp": datetime.now(UTC)},
            {"role": "assistant", "content": ai_response, "timestamp": datetime.now(UTC)}
        ]

        coach_chats_collection.update_one(
            {"userId": user_id},
            {
                "$push": {"messages": {"$each": new_messages}},
                "$set": {"updatedAt": datetime.now(UTC)}
            }
        )

        # Update Moorcheh index with new messages
        index_chat_history(user_id, new_messages)

        # Generate TTS audio for the coach response
        audio_data = None
        if elevenlabs_client:
            try:
                audio_response = elevenlabs_client.text_to_speech.convert(
                    text=ai_response,
                voice_id="pFZP5JQG7iQjIQuC4Bku",  # Bill voice
                model_id="eleven_turbo_v2_5",  # Fast model for chat
                output_format="mp3_44100_128"
            )

                # Convert generator to bytes
                audio_bytes = b"".join(audio_response)

                # Convert to base64 for JSON response
                import base64
                audio_data = base64.b64encode(audio_bytes).decode('utf-8')

                print(f"✓ Generated TTS audio for coach response ({len(audio_bytes)} bytes)")
            except Exception as e:
                print(f"✗ TTS generation failed: {e}")
                # Continue without audio

        response_data = {
            "response": ai_response,
            "context_used": bool(rag_context),
            "audio": audio_data
        }
        print(f"[Coach API] Returning response with audio: {len(audio_data) if audio_data else 0} bytes")
        return jsonify(response_data)

    except Exception as e:
        print(f"Error in coach_chat: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/coach/history', methods=['GET'])
@verify_token_decorator
def get_coach_history():
    """Get user's chat history"""
    try:
        user_id = request.user_id

        chat = coach_chats_collection.find_one({"userId": user_id})
        if not chat:
            return jsonify({"messages": []})

        # Convert timestamps to ISO format
        messages = []
        for msg in chat.get('messages', []):
            msg_copy = msg.copy()
            if isinstance(msg_copy.get('timestamp'), datetime):
                msg_copy['timestamp'] = msg_copy['timestamp'].isoformat()
            messages.append(msg_copy)

        return jsonify({"messages": messages})

    except Exception as e:
        print(f"Error in get_coach_history: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/coach/history', methods=['DELETE'])
@verify_token_decorator
def clear_coach_history():
    """Clear user's chat history"""
    try:
        user_id = request.user_id

        coach_chats_collection.delete_one({"userId": user_id})

        return jsonify({"message": "Chat history cleared"})

    except Exception as e:
        print(f"Error in clear_coach_history: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/coach/medical-info', methods=['GET'])
@verify_token_decorator
def get_medical_info():
    """Get user's medical information from user document"""
    try:
        user_id = request.user_id

        # Get user document
        user = users_collection.find_one({"_id": ObjectId(user_id)})
        if not user:
            return jsonify({'error': 'User not found'}), 404

        # Get medical info from user document
        medical_info = user.get("medicalInfo", {})

        return jsonify({
            "goals": medical_info.get("goals", ""),
            "medicalHistory": medical_info.get("medicalHistory", ""),
            "physicalStatus": medical_info.get("physicalStatus", ""),
            "concerns": medical_info.get("concerns", ""),
            "dietaryRestrictions": medical_info.get("dietaryRestrictions", "")
        })

    except Exception as e:
        print(f"Error in get_medical_info: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/coach/medical-info', methods=['POST'])
@verify_token_decorator
def update_medical_info():
    """Update user's medical information in user document"""
    try:
        user_id = request.user_id
        data = request.get_json()

        # Build medical info object
        medical_info = {}
        if 'goals' in data:
            medical_info['goals'] = data['goals']
        if 'medicalHistory' in data:
            medical_info['medicalHistory'] = data['medicalHistory']
        if 'physicalStatus' in data:
            medical_info['physicalStatus'] = data['physicalStatus']
        if 'concerns' in data:
            medical_info['concerns'] = data['concerns']
        if 'dietaryRestrictions' in data:
            medical_info['dietaryRestrictions'] = data['dietaryRestrictions']

        medical_info['updatedAt'] = datetime.now(UTC).isoformat()

        # Update user document with medical info
        users_collection.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"medicalInfo": medical_info}}
        )

        # Initialize namespace and index medical info for RAG
        initialize_user_namespace(user_id)
        index_medical_info(user_id, medical_info)

        print(f"✓ Updated medical info for user {user_id}")

        return jsonify({"message": "Medical information updated"})

    except Exception as e:
        print(f"Error in update_medical_info: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/coach/settings', methods=['GET'])
@verify_token_decorator
def get_coach_settings():
    """Get user's coach settings from user document"""
    try:
        user_id = request.user_id

        # Get user document
        user = users_collection.find_one({"_id": ObjectId(user_id)})
        if not user:
            return jsonify({'error': 'User not found'}), 404

        # Get coach settings from user document
        coach_settings = user.get("coachSettings", {})

        return jsonify({
            "tonePreference": coach_settings.get("tonePreference", "casual"),
            "responseLength": coach_settings.get("responseLength", "short"),
            "motivationLevel": coach_settings.get("motivationLevel", "moderate"),
            "focusAreas": coach_settings.get("focusAreas", []),
            "notificationPreference": coach_settings.get("notificationPreference", "daily"),
        })

    except Exception as e:
        print(f"Error in get_coach_settings: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/coach/settings', methods=['POST'])
@verify_token_decorator
def update_coach_settings():
    """Update user's coach settings in user document"""
    try:
        user_id = request.user_id
        data = request.get_json()

        # Build coach settings object
        coach_settings = {}
        if 'tonePreference' in data:
            coach_settings['tonePreference'] = data['tonePreference']
        if 'responseLength' in data:
            coach_settings['responseLength'] = data['responseLength']
        if 'motivationLevel' in data:
            coach_settings['motivationLevel'] = data['motivationLevel']
        if 'focusAreas' in data:
            coach_settings['focusAreas'] = data['focusAreas']
        if 'notificationPreference' in data:
            coach_settings['notificationPreference'] = data['notificationPreference']

        coach_settings['updatedAt'] = datetime.now(UTC).isoformat()

        # Update user document with coach settings
        users_collection.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"coachSettings": coach_settings}}
        )

        print(f"✓ Updated coach settings for user {user_id}")

        return jsonify({"message": "Coach settings updated"})

    except Exception as e:
        print(f"Error in update_coach_settings: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/coach/upload-document', methods=['POST'])
@verify_token_decorator
def upload_medical_document():
    """Upload medical document (text only for now) - stores in user document"""
    try:
        user_id = request.user_id
        data = request.get_json()

        name = data.get('name')
        content = data.get('content')

        if not name or not content:
            return jsonify({'error': 'Name and content are required'}), 400

        # Add document to user's medical info in user document
        doc = {
            "id": str(ObjectId()),
            "name": name,
            "content": content,
            "uploadedAt": datetime.now(UTC).isoformat()
        }

        users_collection.update_one(
            {"_id": ObjectId(user_id)},
            {
                "$push": {"medicalInfo.documents": doc},
                "$set": {"medicalInfo.updatedAt": datetime.now(UTC).isoformat()}
            }
        )

        # Index document for RAG
        initialize_user_namespace(user_id)
        namespace = f"user_{user_id}_context"
        try:
            if moorcheh_client:
                moorcheh_client.documents.upload(
                    namespace_name=namespace,
                    documents=[{"id": f"doc_{doc['id']}", "text": f"Document {name}: {content}"}]
                )
        except Exception as e:
            print(f"Failed to index document: {e}")

        print(f"✓ Uploaded document for user {user_id}: {name}")

        return jsonify({"message": "Document uploaded", "documentId": doc['id']})

    except Exception as e:
        print(f"Error in upload_medical_document: {e}")
        return jsonify({'error': str(e)}), 500

# ============================================================================
# RUN SERVER
# ============================================================================

if __name__ == '__main__':
    print("\n" + "="*50)
    print("🏋️  Motion4Good Flask Backend")
    print("="*50)
    print(f"Database: {MONGODB_DB_NAME}")
    print("Server: http://localhost:8000")
    print("="*50 + "\n")

    app.run(host='0.0.0.0', port=8000, debug=True)
