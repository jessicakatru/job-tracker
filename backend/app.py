import os
import certifi
from flask import Flask, request, jsonify
from flask_cors import CORS
from pymongo import MongoClient
import bcrypt
import jwt
import datetime

app = Flask(__name__)
CORS(app)

# Secret key for JWT (from environment variable)
SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "jobtracker_secret_123")

# MongoDB connection (from environment variable)
MONGO_URI = os.environ.get("MONGO_URI")
client = MongoClient(MONGO_URI, tlsCAFile=certifi.where())
db = client["jobtracker"]
users_collection = db["users"]
jobs_collection = db["jobs"]

# ─── SIGNUP ───────────────────────────────────────
@app.route("/signup", methods=["POST"])
def signup():
    data = request.json
    name = data.get("name")
    email = data.get("email")
    password = data.get("password")

    if not name or not email or not password:
        return jsonify({"error": "All fields required"}), 400

    # Check if user already exists
    if users_collection.find_one({"email": email}):
        return jsonify({"error": "Email already registered"}), 400

    # Hash password
    hashed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt())

    # Save user
    users_collection.insert_one({
        "name": name,
        "email": email,
        "password": hashed
    })

    return jsonify({"message": "Signup successful!"}), 201


# ─── LOGIN ────────────────────────────────────────
@app.route("/login", methods=["POST"])
def login():
    data = request.json
    email = data.get("email")
    password = data.get("password")

    if not email or not password:
        return jsonify({"error": "Email and password required"}), 400

    # Find user
    user = users_collection.find_one({"email": email})
    if not user:
        return jsonify({"error": "User not found"}), 404

    # Check password
    if not bcrypt.checkpw(password.encode("utf-8"), user["password"]):
        return jsonify({"error": "Wrong password"}), 401

    # Generate JWT token
    token = jwt.encode({
        "email": email,
        "name": user["name"],
        "exp": datetime.datetime.utcnow() + datetime.timedelta(days=7)
    }, SECRET_KEY, algorithm="HS256")

    return jsonify({
        "message": "Login successful!",
        "token": token,
        "name": user["name"]
    }), 200


# ─── VERIFY TOKEN ─────────────────────────────────
def verify_token(request):
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    if not token:
        return None
    try:
        decoded = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        return decoded
    except:
        return None


# ─── ADD JOB ──────────────────────────────────────
@app.route("/jobs", methods=["POST"])
def add_job():
    user = verify_token(request)
    if not user:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.json
    job = {
        "email": user["email"],
        "company": data.get("company"),
        "role": data.get("role"),
        "date": data.get("date"),
        "status": data.get("status"),
        "notes": data.get("notes", ""),
        "created_at": datetime.datetime.utcnow()
    }
    result = jobs_collection.insert_one(job)
    job["_id"] = str(result.inserted_id)
    return jsonify(job), 201


# ─── GET JOBS ─────────────────────────────────────
@app.route("/jobs", methods=["GET"])
def get_jobs():
    user = verify_token(request)
    if not user:
        return jsonify({"error": "Unauthorized"}), 401

    jobs = list(jobs_collection.find(
        {"email": user["email"]},
        {"_id": 1, "company": 1, "role": 1, "date": 1, "status": 1, "notes": 1}
    ).sort("created_at", -1))

    for job in jobs:
        job["_id"] = str(job["_id"])

    return jsonify(jobs), 200


# ─── UPDATE JOB STATUS ────────────────────────────
@app.route("/jobs/<job_id>", methods=["PUT"])
def update_job(job_id):
    user = verify_token(request)
    if not user:
        return jsonify({"error": "Unauthorized"}), 401

    from bson import ObjectId
    data = request.json
    jobs_collection.update_one(
        {"_id": ObjectId(job_id), "email": user["email"]},
        {"$set": {"status": data.get("status")}}
    )
    return jsonify({"message": "Updated!"}), 200


# ─── DELETE JOB ───────────────────────────────────
@app.route("/jobs/<job_id>", methods=["DELETE"])
def delete_job(job_id):
    user = verify_token(request)
    if not user:
        return jsonify({"error": "Unauthorized"}), 401

    from bson import ObjectId
    jobs_collection.delete_one(
        {"_id": ObjectId(job_id), "email": user["email"]}
    )
    return jsonify({"message": "Deleted!"}), 200


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(debug=True, host="0.0.0.0", port=port)