#!/usr/bin/env python3

def test_comprehensive_scenarios():
    """Test various scenarios that could cause unknown status"""
    
    import json
    import main
    
    app = main.app
    test_cases = [
        # Case 1: Completely empty email
        {
            'name': 'Completely empty',
            'data': {'subject': '', 'sender': '', 'body': ''}
        },
        # Case 2: Whitespace only
        {
            'name': 'Whitespace only',
            'data': {'subject': '   ', 'sender': '  ', 'body': '   '}
        },
        # Case 3: Very short content
        {
            'name': 'Very short content',
            'data': {'subject': 'Hi', 'sender': 'a@b.c', 'body': 'Ok'}
        },
        # Case 4: Missing sender
        {
            'name': 'Missing sender',
            'data': {'subject': 'Test subject', 'sender': '', 'body': 'Test body'}
        },
        # Case 5: Normal email
        {
            'name': 'Normal email',
            'data': {'subject': 'Meeting reminder', 'sender': 'user@company.com', 'body': 'This is a normal email with proper content.'}
        }
    ]
    
    print("=== COMPREHENSIVE UNKNOWN STATUS TEST ===")
    all_passed = True
    
    for i, test_case in enumerate(test_cases, 1):
        print(f"\n--- Test {i}: {test_case['name']} ---")
        
        with app.test_client() as client:
            response = client.post('/scan-email-links', 
                                 data=json.dumps(test_case['data']),
                                 content_type='application/json')
            
            if response.status_code == 200:
                result = response.get_json()
                status = result.get('status', 'ERROR')
                
                print(f"Status: {status}")
                print(f"Category: {result.get('email_category', 'ERROR')}")
                print(f"Confidence: {result.get('confidence', 0):.3f}")
                
                if status == 'unknown':
                    print(f"❌ FAILED: Got unknown status for {test_case['name']}")
                    all_passed = False
                else:
                    print(f"✅ PASSED: {test_case['name']}")
            else:
                print(f"❌ HTTP Error {response.status_code}")
                all_passed = False
    
    return all_passed

if __name__ == "__main__":
    print("Testing all edge cases that could cause 'unknown' status...")
    
    success = test_comprehensive_scenarios()
    
    if success:
        print("\n🎉 ALL COMPREHENSIVE TESTS PASSED!")
        print("The 'unknown' status issue is completely resolved!")
    else:
        print("\n❌ SOME TESTS FAILED")
        print("There may still be edge cases causing unknown status.")
