from pymongo import MongoClient

# Connection String ကို တိုက်ရိုက်ထည့်ပါမယ် (မှန်ကန်သော String ဖြစ်ပါတယ်)
MONGO_URI = "mongodb+srv://admin:jNyKLA7vQP1wwSiP@cluster0.pjotkzv.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"
DB_NAME = "epl_tournament_db"

def get_db():
    try:
        # Connection String ဖြင့် MongoDB Atlas ကို ချိတ်ဆက်ခြင်း
        client = MongoClient(MONGO_URI)
        
        # Connection အလုပ်လုပ်မလုပ် စမ်းသပ်ရန် (Ping)
        client.admin.command('ping')
        
        db = client[DB_NAME]
        print("✅ Connected to MongoDB Atlas successfully!")
        return db
    except Exception as e:
        print(f"❌ Connection Error: {e}")
        return None