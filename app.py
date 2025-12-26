from flask import Flask, render_template, request, redirect, url_for, flash, jsonify, session
from flask_bcrypt import Bcrypt
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user, current_user
from pymongo import MongoClient
from bson.objectid import ObjectId
import os
import requests
import pyotp
import qrcode
import io
import base64
import xml.etree.ElementTree as ET
from datetime import datetime
from dotenv import load_dotenv

# --- SETUP & CONFIG ---
load_dotenv()
app = Flask(__name__)
app.config['SECRET_KEY'] = 'supersecretkey123' 

bcrypt = Bcrypt(app)
login_manager = LoginManager(app)
login_manager.login_view = 'landing'

# --- DATABASE CONNECTION ---
MONGO_URI = "mongodb+srv://admin:jNyKLA7vQP1wwSiP@cluster0.pjotkzv.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"
DB_NAME = "epl_tournament_db"

try:
    client = MongoClient(MONGO_URI)
    db = client[DB_NAME]
    users_collection = db.users
    teams_collection = db.teams
    matches_collection = db.matches
    news_collection = db.news
    print("✅ Connected to MongoDB Atlas successfully!")
except Exception as e:
    print(f"❌ Connection Error: {e}")

# --- USER MODEL ---
class User(UserMixin):
    def __init__(self, user_data):
        self.id = str(user_data['_id'])
        self.username = user_data['username']
        self.email = user_data.get('email')
        self.role = user_data.get('role', 'client')
        self.mfa_secret = user_data.get('mfa_secret')

@login_manager.user_loader
def load_user(user_id):
    try:
        user_data = users_collection.find_one({"_id": ObjectId(user_id)})
        if user_data: return User(user_data)
    except: return None
    return None

# --- PAGE ROUTES ---
@app.route('/')
def landing():
    if current_user.is_authenticated:
        return redirect(url_for('dashboard') if current_user.role == 'admin' else url_for('live_page'))
    return render_template('landing.html')

@app.route('/live')
@login_required
def live_page(): return render_template('live.html')

@app.route('/standings')
@login_required
def standings_page(): return render_template('standings.html')

@app.route('/results')
@login_required
def results_page(): return render_template('results.html')

@app.route('/news')
@login_required
def news_page(): return render_template('news.html')

@app.route('/team/<team_code>')
@login_required
def team_details(team_code): return render_template('team_details.html', team_code=team_code)

@app.route('/dashboard')
@login_required
def dashboard():
    if current_user.role != 'admin':
        flash("⛔ Access Denied: Admins only!", "danger")
        return redirect(url_for('live_page'))
    return render_template('dashboard.html')

# --- AUTH FLOW ---

# 1. Login Routes
@app.route('/admin-login', methods=['GET', 'POST'])
def admin_login():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        user = users_collection.find_one({"username": username, "role": "admin"})
        if user and bcrypt.check_password_hash(user['password'], password):
            if user.get('mfa_enabled'):
                session['temp_user_id'] = str(user['_id'])
                return redirect(url_for('verify_2fa'))
            else:
                login_user(User(user))
                return redirect(url_for('dashboard'))
        else: flash('Login Failed.', 'danger')
    return render_template('login.html', user_type="Admin")

@app.route('/client-login', methods=['GET', 'POST'])
def client_login():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        user = users_collection.find_one({"username": username, "role": "client"})
        if user and bcrypt.check_password_hash(user['password'], password):
            if user.get('mfa_enabled'):
                session['temp_user_id'] = str(user['_id'])
                return redirect(url_for('verify_2fa'))
            else:
                login_user(User(user))
                return redirect(url_for('live_page'))
        else: flash('Login Failed.', 'danger')
    return render_template('login.html', user_type="Client")

# 2. Register
@app.route('/register/<user_type>', methods=['GET', 'POST'])
def register(user_type):
    if request.method == 'POST':
        username = request.form.get('username')
        email = request.form.get('email')
        password = request.form.get('password')
        
        if users_collection.find_one({"username": username}):
            flash('Username exists.', 'danger')
            return redirect(url_for('register', user_type=user_type))
            
        mfa_secret = pyotp.random_base32()
        role = "admin" if user_type == "admin" else "client"
        hashed = bcrypt.generate_password_hash(password).decode('utf-8')
        
        uid = users_collection.insert_one({
            "username": username, 
            "email": email,
            "password": hashed, 
            "role": role, 
            "mfa_secret": mfa_secret, 
            "mfa_enabled": False
        }).inserted_id
        
        session['setup_user_id'] = str(uid)
        return redirect(url_for('setup_mfa'))
    return render_template('register.html', user_type=user_type)

# 3. MFA Setup
@app.route('/setup-mfa', methods=['GET', 'POST'])
def setup_mfa():
    if 'setup_user_id' not in session: return redirect(url_for('landing'))
    uid = session['setup_user_id']
    user = users_collection.find_one({"_id": ObjectId(uid)})
    
    if request.method == 'POST':
        if pyotp.TOTP(user['mfa_secret']).verify(request.form.get('otp_code')):
            users_collection.update_one({"_id": ObjectId(uid)}, {"$set": {"mfa_enabled": True}})
            session.pop('setup_user_id', None)
            flash("MFA Setup Complete! Please Login.", "success")
            return redirect(url_for('admin_login' if user['role']=='admin' else 'client_login'))
        flash("Invalid Code. Try again.", "danger")
        
    qr = qrcode.make(pyotp.totp.TOTP(user['mfa_secret']).provisioning_uri(name=user['username'], issuer_name="EPL Zone"))
    img = io.BytesIO()
    qr.save(img, 'PNG')
    img.seek(0)
    return render_template('mfa_setup.html', qr_code=base64.b64encode(img.getvalue()).decode('utf-8'), secret=user['mfa_secret'])

# 4. MFA Verification
@app.route('/verify-2fa', methods=['GET', 'POST'])
def verify_2fa():
    if 'temp_user_id' not in session: return redirect(url_for('landing'))
    
    if request.method == 'POST':
        user = users_collection.find_one({"_id": ObjectId(session['temp_user_id'])})
        if pyotp.TOTP(user['mfa_secret']).verify(request.form.get('otp_code')):
            session.pop('temp_user_id', None)
            login_user(User(user))
            return redirect(url_for('dashboard' if user['role']=='admin' else 'live_page'))
        flash("Invalid Authenticator Code", "danger")
    return render_template('verify_2fa.html')

# 5. FORGOT PASSWORD (OTP BASED)
@app.route('/forgot-password', methods=['GET', 'POST'])
def forgot_password():
    if request.method == 'POST':
        email = request.form.get('email')
        otp_code = request.form.get('otp_code')
        new_password = request.form.get('password')

        user = users_collection.find_one({"email": email})

        if not user:
            flash('Email not found.', 'danger')
            return redirect(url_for('forgot_password'))

        if not user.get('mfa_enabled') or not user.get('mfa_secret'):
            flash('Two-Factor Authentication is not set up. Cannot reset via OTP.', 'warning')
            return redirect(url_for('forgot_password'))

        totp = pyotp.TOTP(user['mfa_secret'])
        if totp.verify(otp_code):
            if new_password:
                hashed_password = bcrypt.generate_password_hash(new_password).decode('utf-8')
                users_collection.update_one(
                    {"_id": user['_id']},
                    {"$set": {"password": hashed_password}}
                )
                flash('✅ Password reset successful! Please login.', 'success')
                return redirect(url_for('landing'))
            else:
                flash('Password cannot be empty.', 'danger')
        else:
            flash('❌ Invalid Authenticator Code.', 'danger')

    return render_template('forgot_password.html')

@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('landing'))

# --- API ROUTES ---
@app.route('/api/data', methods=['GET'])
def get_all_data():
    teams_list = []
    cursor = teams_collection.find({})
    for t in cursor:
        t['_id'] = str(t['_id'])
        if 'code' not in t: t['code'] = "UNK"
        if 'name' not in t: t['name'] = "Unknown"
        if 'logo' not in t: t['logo'] = "⚽"
        teams_list.append(t)
    matches_list = []
    m_cursor = matches_collection.find({})
    for m in m_cursor:
        m['_id'] = str(m['_id'])
        matches_list.append(m)
    return jsonify({"teams": teams_list, "matches": matches_list})

@app.route('/api/live-epl', methods=['GET'])
def get_live_epl_scores():
    url = "https://v3.football.api-sports.io/fixtures"
    headers = {"x-apisports-key": "6bc44922070120a601e0b25980ca97b6"}
    querystring = {"league":"39", "season":"2023", "status":"FT"}
    try:
        response = requests.get(url, headers=headers, params=querystring)
        data = response.json()
        if data.get('response'):
            all_matches = data['response']
            demo_matches = all_matches[-5:]
            for index, match in enumerate(demo_matches):
                fake_minute = 15 + (index * 12)
                match['fixture']['status']['short'] = '1H' if index < 3 else '2H'
                match['fixture']['status']['long'] = 'First Half'
                match['fixture']['status']['elapsed'] = fake_minute
            data['response'] = demo_matches
        return jsonify(data)
    except Exception as e:
        return jsonify({"error": str(e)})

@app.route('/api/fixtures', methods=['GET'])
def get_all_fixtures():
    url = "https://v3.football.api-sports.io/fixtures"
    querystring = {"league":"39", "season":"2023"} 
    headers = {"x-apisports-key": "6bc44922070120a601e0b25980ca97b6"}
    try:
        response = requests.get(url, headers=headers, params=querystring)
        return jsonify(response.json())
    except Exception as e:
        return jsonify({"error": str(e)})

@app.route('/api/standings', methods=['GET'])
def get_epl_standings():
    url = "https://v3.football.api-sports.io/standings"
    querystring = {"league":"39", "season":"2023"}
    headers = {"x-apisports-key": "6bc44922070120a601e0b25980ca97b6"}
    try:
        response = requests.get(url, headers=headers, params=querystring)
        return jsonify(response.json())
    except Exception as e:
        return jsonify({"error": str(e)})

@app.route('/api/squad/<int:team_id>', methods=['GET'])
def get_squad(team_id):
    url = "https://v3.football.api-sports.io/players/squads"
    querystring = {"team": str(team_id)}
    headers = {"x-apisports-key": "6bc44922070120a601e0b25980ca97b6"}
    try:
        response = requests.get(url, headers=headers, params=querystring)
        return jsonify(response.json())
    except Exception as e:
        return jsonify({"error": str(e)})

@app.route('/api/events/<int:fixture_id>', methods=['GET'])
def get_match_events(fixture_id):
    url = "https://v3.football.api-sports.io/fixtures/events"
    querystring = {"fixture": str(fixture_id)}
    headers = {"x-apisports-key": "6bc44922070120a601e0b25980ca97b6"}
    try:
        response = requests.get(url, headers=headers, params=querystring)
        return jsonify(response.json())
    except Exception as e:
        return jsonify({"error": str(e)})

# Match Statistics API
@app.route('/api/stats/<int:fixture_id>', methods=['GET'])
def get_match_stats(fixture_id):
    url = "https://v3.football.api-sports.io/fixtures/statistics"
    querystring = {"fixture": str(fixture_id)}
    headers = {"x-apisports-key": "6bc44922070120a601e0b25980ca97b6"}
    try:
        response = requests.get(url, headers=headers, params=querystring)
        return jsonify(response.json())
    except Exception as e:
        return jsonify({"error": str(e)})

@app.route('/api/external-news', methods=['GET'])
def get_football_news():
    try:
        url = "http://feeds.bbci.co.uk/sport/football/premier-league/rss.xml"
        response = requests.get(url)
        root = ET.fromstring(response.content)
        news_items = []
        namespaces = {'media': 'http://search.yahoo.com/mrss/'}

        for item in root.findall('./channel/item')[:12]:
            title = item.find('title').text
            link = item.find('link').text
            desc = item.find('description').text
            pub_date = item.find('pubDate').text if item.find('pubDate') is not None else "Recent"
            
            image = "https://upload.wikimedia.org/wikipedia/en/f/f2/Premier_League_Logo.svg"
            try:
                media = item.find('media:thumbnail', namespaces)
                if media is not None:
                    image = media.attrib['url']
            except: pass

            news_items.append({'title': title, 'link': link, 'content': desc, 'image': image, 'date': pub_date[:16]})
            
        return jsonify(news_items)
    except Exception as e:
        return jsonify({"error": str(e)})

# CRUD Routes (Local DB)
@app.route('/api/team', methods=['POST'])
@login_required
def api_register_team():
    if current_user.role != 'admin': return jsonify({"error": "Unauthorized"}), 403
    data = request.get_json()
    teams_collection.insert_one({"name": data['name'], "code": data['code'].upper(), "logo": data['logo'], "players": []})
    return jsonify({"status": "success"})

# 🟢 UPDATE: Register Player (Upsert Team)
@app.route('/api/player', methods=['POST'])
@login_required
def api_register_player():
    if current_user.role != 'admin': return jsonify({"error": "Unauthorized"}), 403
    data = request.get_json()
    
    # Update if exists, Insert if not
    teams_collection.update_one(
        {"code": str(data['team_code'])},
        {
            "$push": {
                "players": {
                    "name": data['name'], 
                    "number": data['number'], 
                    "pos": data['pos'],
                    "is_local": True
                }
            },
            "$setOnInsert": {"name": "Custom Team", "logo": ""}
        },
        upsert=True
    )
    return jsonify({"status": "success"})

# 🟢 NEW: Get Local Squad
@app.route('/api/local-squad/<team_code>', methods=['GET'])
def get_local_squad(team_code):
    team = teams_collection.find_one({"code": str(team_code)})
    if team and 'players' in team:
        return jsonify(team['players'])
    return jsonify([])

@app.route('/api/player/<team_code>/<player_name>', methods=['DELETE'])
@login_required
def delete_player(team_code, player_name):
    if current_user.role != 'admin': return jsonify({"error": "Unauthorized"}), 403
    teams_collection.update_one({"code": team_code}, {"$pull": {"players": {"name": player_name}}})
    return jsonify({"status": "success"})

@app.route('/api/match', methods=['POST'])
@login_required
def api_add_match():
    if current_user.role != 'admin': return jsonify({"error": "Unauthorized"}), 403
    matches_collection.insert_one(request.get_json())
    return jsonify({"status": "success"})

@app.route('/api/match/<match_id>', methods=['DELETE'])
@login_required
def api_delete_match(match_id):
    if current_user.role != 'admin': return jsonify({"error": "Unauthorized"}), 403
    matches_collection.delete_one({"_id": ObjectId(match_id)})
    return jsonify({"status": "success"})

# Legacy News Routes
@app.route('/api/news', methods=['GET', 'POST'])
def api_news():
    if request.method == 'GET':
        news_list = [{**n, '_id': str(n['_id'])} for n in news_collection.find().sort("date", -1)]
        return jsonify(news_list)
    if request.method == 'POST' and current_user.role == 'admin':
        data = request.get_json()
        news_item = {"title": data['title'], "content": data['content'], "image": data.get('image', ''), "date": datetime.now().strftime("%Y-%m-%d %H:%M")}
        news_collection.insert_one(news_item)
        return jsonify({"status": "success"})
    return jsonify({"error": "Unauthorized"}), 403

@app.route('/api/news/<news_id>', methods=['DELETE'])
@login_required
def delete_news(news_id):
    if current_user.role != 'admin': return jsonify({"error": "Unauthorized"}), 403
    news_collection.delete_one({"_id": ObjectId(news_id)})
    return jsonify({"status": "success"})

if __name__ == '__main__':
    app.run(debug=True)