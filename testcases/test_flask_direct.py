#!/usr/bin/env python3

def test_flask_endpoint_directly():
    """Test the actual Flask endpoint function directly"""
    
    print("=== TESTING FLASK ENDPOINT FUNCTION ===")
    
    try:
        # Import the function we need to test
        import sys
        import os
        sys.path.append(os.path.dirname(os.path.abspath(__file__)))
        
        # Try to import main module
        import main
        print("✅ Main module imported successfully")
        
        # Test using Flask test client
        app = main.app
        
        with app.test_client() as client:
            print("\nTesting empty email...")
            
            import json
            test_data = {
                'subject': '',
                'sender': '',
                'body': ''
            }
            
            response = client.post('/scan-email-links', 
                                 data=json.dumps(test_data),
                                 content_type='application/json')
            
            print(f"Response status: {response.status_code}")
            
            if response.status_code == 200:
                result = response.get_json()
                status = result.get('status', 'ERROR')
                
                print(f"Email status: {status}")
                print(f"Email category: {result.get('email_category', 'ERROR')}")
                print(f"Confidence: {result.get('confidence', 'ERROR')}")
                print(f"Message: {result.get('message', 'ERROR')}")
                
                if status == 'unknown':
                    print("❌ CRITICAL: Still getting unknown status in Flask endpoint!")
                    return False
                else:
                    print("✅ SUCCESS: Flask endpoint fixed - no more unknown status!")
                    return True
                    
            else:
                print(f"❌ HTTP Error {response.status_code}")
                print(f"Response data: {response.data.decode()}")
                return False
                
    except Exception as e:
        print(f"❌ Error testing Flask endpoint: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = test_flask_endpoint_directly()
    
    if success:
        print("\n🎉 FLASK ENDPOINT TEST PASSED!")
        print("The 'unknown' status issue has been successfully fixed!")
    else:
        print("\n❌ FLASK ENDPOINT TEST FAILED")
        print("There may still be issues with the Flask endpoint.")
