#!/usr/bin/env python3
"""
Test script for candidate name extraction functionality.
Run this to verify LLM-based name extraction is working correctly.
"""

import asyncio
import json
from datetime import datetime
from resumematching import AzureOpenAIClient, CandidateNameExtractor

# Test data samples
TEST_CASES = [
    {
        "filename": "Nikhil CV 3 - nikhil patel.pdf",
        "resume_text": """
        NIKHIL PATEL
        Software Engineer | Full Stack Developer
        Email: nikhil.patel@email.com
        Phone: +1-555-123-4567
        Location: San Francisco, CA
        
        PROFESSIONAL SUMMARY
        Experienced software engineer with 5+ years of expertise in full-stack development...
        """,
        "expected_name": "Nikhil Patel"
    },
    {
        "filename": "ckgsalesforcedeveloper - CHANDAN KUMAR GUPTA (1).pdf",
        "resume_text": """
        CHANDAN KUMAR GUPTA
        Salesforce Developer
        chandan.gupta@salesforce.com
        Mobile: +91-9876543210
        
        CAREER OBJECTIVE
        To leverage my Salesforce development expertise in a dynamic organization...
        """,
        "expected_name": "Chandan Kumar Gupta"
    },
    {
        "filename": "resume_john_smith_updated.docx",
        "resume_text": """
        John Smith
        Senior Data Scientist
        john.smith@company.com
        
        EXPERIENCE
        Data Scientist at Google (2020-Present)
        - Developed machine learning models for recommendation systems
        """,
        "expected_name": "John Smith"
    },
    {
        "filename": "Dr_Sarah_Johnson_CV.pdf",
        "resume_text": """
        Dr. Sarah Johnson, PhD
        Research Scientist | Machine Learning Engineer
        sarah.johnson@research.edu
        
        EDUCATION
        PhD in Computer Science, Stanford University (2018)
        """,
        "expected_name": "Sarah Johnson"
    },
    {
        "filename": "resume_final_v2.pdf",
        "resume_text": """
        Contact Information:
        Name: Michael Chen
        Email: michael.chen@tech.com
        Phone: (555) 987-6543
        
        PROFILE
        Experienced DevOps Engineer with expertise in cloud infrastructure...
        """,
        "expected_name": "Michael Chen"
    }
]

async def test_name_extraction():
    """Test candidate name extraction with sample data"""
    
    print("🧪 Testing Candidate Name Extraction")
    print("=" * 50)
    
    try:
        # Initialize the name extractor
        openai_client = AzureOpenAIClient()
        name_extractor = CandidateNameExtractor(openai_client)
        
        results = []
        
        for i, test_case in enumerate(TEST_CASES, 1):
            print(f"\n📋 Test Case {i}: {test_case['filename']}")
            print(f"Expected: {test_case['expected_name']}")
            
            # Extract name using LLM
            extracted_name = await name_extractor.extract_candidate_name(
                test_case["resume_text"], 
                test_case["filename"]
            )
            
            # Also test filename fallback
            filename_fallback = name_extractor._extract_name_from_filename(test_case["filename"])
            
            # Determine if extraction was successful
            is_correct = extracted_name.lower() == test_case["expected_name"].lower()
            status = "✅ PASS" if is_correct else "❌ FAIL"
            
            print(f"LLM Extracted: {extracted_name}")
            print(f"Filename Fallback: {filename_fallback}")
            print(f"Status: {status}")
            
            results.append({
                "test_case": i,
                "filename": test_case["filename"],
                "expected": test_case["expected_name"],
                "extracted": extracted_name,
                "filename_fallback": filename_fallback,
                "success": is_correct,
                "timestamp": datetime.now().isoformat()
            })
            
            # Small delay to respect rate limits
            await asyncio.sleep(1)
        
        # Print summary
        print("\n" + "=" * 50)
        print("📊 TEST SUMMARY")
        print("=" * 50)
        
        total_tests = len(results)
        passed_tests = sum(1 for r in results if r["success"])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests} ✅")
        print(f"Failed: {failed_tests} ❌")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        if failed_tests > 0:
            print("\n❌ Failed Test Cases:")
            for result in results:
                if not result["success"]:
                    print(f"  - {result['filename']}: Expected '{result['expected']}', Got '{result['extracted']}'")
        
        # Save results to file
        with open("name_extraction_test_results.json", "w") as f:
            json.dump(results, f, indent=2)
        
        print(f"\n📁 Results saved to: name_extraction_test_results.json")
        
        return results
        
    except Exception as e:
        print(f"❌ Error during testing: {str(e)}")
        return []

async def test_single_extraction(resume_text: str, filename: str):
    """Test single name extraction"""
    
    print(f"\n🔍 Testing Single Extraction")
    print(f"Filename: {filename}")
    print(f"Resume Preview: {resume_text[:200]}...")
    
    try:
        openai_client = AzureOpenAIClient()
        name_extractor = CandidateNameExtractor(openai_client)
        
        extracted_name = await name_extractor.extract_candidate_name(resume_text, filename)
        filename_fallback = name_extractor._extract_name_from_filename(filename)
        
        print(f"✅ LLM Extracted: {extracted_name}")
        print(f"📁 Filename Fallback: {filename_fallback}")
        
        return extracted_name
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return None

if __name__ == "__main__":
    print("🚀 Starting Candidate Name Extraction Tests")
    print("Make sure your Azure OpenAI credentials are configured!")
    print()
    
    # Run the comprehensive test
    results = asyncio.run(test_name_extraction())
    
    # Optionally run a single test
    # asyncio.run(test_single_extraction(
    #     "JOHN DOE\nSoftware Engineer\njohn.doe@email.com", 
    #     "john_doe_resume.pdf"
    # ))
    
    print("\n🎉 Testing Complete!") 