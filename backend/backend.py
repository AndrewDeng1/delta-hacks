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
from datetime import datetime, timedelta
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
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
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
            "createdAt": datetime.utcnow()
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
            "createdAt": datetime.utcnow()
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

        # Read current counts
        with open(rep_file_path, 'r') as f:
            counts = json.load(f)

        # Reset to 0
        reset_counts = {k: 0 for k in counts.keys()}
        with open(rep_file_path, 'w') as f:
            json.dump(reset_counts, f, indent=2)

        return jsonify(counts)

    except FileNotFoundError:
        # Initialize file if it doesn't exist
        default_counts = {"jumping_jacks": 0, "squats": 0, "high_knees": 0}
        with open(rep_file_path, 'w') as f:
            json.dump(default_counts, f, indent=2)
        return jsonify(default_counts)
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
