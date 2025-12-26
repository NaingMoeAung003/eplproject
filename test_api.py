import requests

# မိတ်ဆွေရဲ့ API Key (ပုံထဲကအတိုင်း)
API_KEY = "6bc44922070120a601e0b25980ca97b6"

def test_direct_api():
    print("\n🚀 Testing Direct API-SPORTS Endpoint...")
    url = "https://v3.football.api-sports.io/status"
    headers = {
        "x-apisports-key": API_KEY
    }
    try:
        response = requests.get(url, headers=headers)
        data = response.json()
        print(f"Status Code: {response.status_code}")
        print("Response:", data)
        
        if response.status_code == 200:
            print("✅ CONNECTION SUCCESSFUL! (Direct API is working)")
            return True
        else:
            print("❌ CONNECTION FAILED.")
            return False
    except Exception as e:
        print("Error:", e)
        return False

if __name__ == "__main__":
    test_direct_api()