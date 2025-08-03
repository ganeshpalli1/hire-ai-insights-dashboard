# Resume Screening System with Azure OpenAI - Simplified Version
# Production-grade application for analyzing resumes with classification

import os
import asyncio
import logging
import json
import hashlib
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict
from concurrent.futures import ThreadPoolExecutor
import time
from functools import wraps
import re
from collections import defaultdict
import uuid
from io import BytesIO
import traceback

import aiofiles
import requests
from pydantic import BaseModel, Field, field_validator
from openai import AzureOpenAI
import tiktoken
from tenacity import retry, stop_after_attempt, wait_exponential
import numpy as np
from prometheus_client import Counter, Histogram, Gauge, generate_latest
import PyPDF2
import docx
from fastapi import FastAPI, HTTPException, BackgroundTasks, UploadFile, File, Response, Query, Request
from fastapi.responses import JSONResponse, PlainTextResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exception_handlers import request_validation_exception_handler
from fastapi.exceptions import RequestValidationError
import uvicorn
import httpx

# Supabase integration
try:
    from supabase import create_client, Client
    SUPABASE_AVAILABLE = True
    print("✅ Supabase client imported successfully")
except ImportError:
    SUPABASE_AVAILABLE = False
    print("⚠️  Supabase not available. Install with: pip install supabase")

# Load environment variables from .env file
try:
    from dotenv import load_dotenv
    load_dotenv()
    print("✅ Environment variables loaded from .env file")
except ImportError:
    print("⚠️  python-dotenv not installed. Please install with: pip install python-dotenv")
    print("   Environment variables will be read from system environment")

# Configuration
class Config:
    """Application configuration"""
    AZURE_OPENAI_API_KEY = os.getenv("AZURE_OPENAI_API_KEY")
    AZURE_OPENAI_ENDPOINT = os.getenv("AZURE_OPENAI_ENDPOINT")
    AZURE_OPENAI_DEPLOYMENT = os.getenv("AZURE_OPENAI_DEPLOYMENT", "gpt-4")
    AZURE_OPENAI_API_VERSION = os.getenv("AZURE_OPENAI_API_VERSION", "2024-02-01")
    
    # Supabase configuration
    SUPABASE_URL = os.getenv("SUPABASE_URL", "https://ulrvgfvnysfqjykwfvfm.supabase.co")
    SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVscnZnZnZueXNmcWp5a3dmdmZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgwMjYyMjYsImV4cCI6MjA2MzYwMjIyNn0.4UELfVEzDLR1iWk3b4386Ng53N49LFbfGiY3FwfGWYk")
    
    MAX_TOKENS_PER_REQUEST = 2000
    MAX_RETRIES = 3
    BATCH_SIZE = 50
    MAX_CONCURRENT_REQUESTS = 10
    
    LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
    
    @classmethod
    def validate(cls):
        """Validate that required environment variables are set"""
        errors = []
        if not cls.AZURE_OPENAI_API_KEY:
            errors.append("AZURE_OPENAI_API_KEY is not set")
        if not cls.AZURE_OPENAI_ENDPOINT:
            errors.append("AZURE_OPENAI_ENDPOINT is not set")
        
        if errors:
            print("❌ Environment Variable Errors:")
            for error in errors:
                print(f"   - {error}")
            print("\n📝 Please check your .env file or system environment variables")
            return False
        else:
            print("✅ All required environment variables are set")
            print(f"   • Endpoint: {cls.AZURE_OPENAI_ENDPOINT}")
            print(f"   • Deployment: {cls.AZURE_OPENAI_DEPLOYMENT}")
            print(f"   • API Version: {cls.AZURE_OPENAI_API_VERSION}")
            if SUPABASE_AVAILABLE:
                print(f"   • Supabase URL: {cls.SUPABASE_URL}")
                print("   • Supabase integration: Enabled")
            else:
                print("   • Supabase integration: Disabled")
            return True

# Initialize logging
logging.basicConfig(
    level=getattr(logging, Config.LOG_LEVEL),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize metrics - handle duplicates gracefully
try:
    resume_processed_counter = Counter('resumes_processed_total', 'Total number of resumes processed')
except ValueError:
    # Metric already exists, create a dummy counter that does nothing
    class DummyCounter:
        def inc(self, amount=1): pass
        def labels(self, **kwargs): return self
    resume_processed_counter = DummyCounter()

try:
    processing_time_histogram = Histogram('resume_processing_duration_seconds', 'Resume processing duration')
except ValueError:
    class DummyHistogram:
        def time(self): 
            return self
        def __enter__(self): return self
        def __exit__(self, *args): pass
    processing_time_histogram = DummyHistogram()

try:
    active_jobs_gauge = Gauge('active_processing_jobs', 'Number of active processing jobs')
except ValueError:
    class DummyGauge:
        def inc(self, amount=1): pass
        def dec(self, amount=1): pass
        def set(self, value): pass
        @property
        def _value(self):
            class DummyValue:
                def get(self): return 0
            return DummyValue()
    active_jobs_gauge = DummyGauge()

try:
    classification_counter = Counter('resume_classification', 'Resume classifications', ['category', 'level'])
except ValueError:
    class DummyLabeledCounter:
        def labels(self, **kwargs): 
            class DummyCounter:
                def inc(self, amount=1): pass
            return DummyCounter()
    classification_counter = DummyLabeledCounter()

# Supabase storage integration
class SupabaseStore:
    """Supabase storage for persistent data"""
    def __init__(self):
        self.supabase = None
        if SUPABASE_AVAILABLE and Config.SUPABASE_URL and Config.SUPABASE_ANON_KEY:
            try:
                # Try the most basic client creation possible
                import supabase
                self.supabase = supabase.create_client(
                    Config.SUPABASE_URL,
                    Config.SUPABASE_ANON_KEY
                )
                logger.info("✅ Supabase client initialized successfully")
                
                # Test the connection
                try:
                    test_result = self.supabase.table("job_posts").select("count").limit(1).execute()
                    logger.info("✅ Supabase connection test successful")
                    
                    # Note: Interview setup data will be ensured during application startup
                    
                except Exception as test_error:
                    logger.warning(f"⚠️ Supabase connection test failed: {str(test_error)}")
                    # Don't fail initialization if test fails, just warn
                    
            except Exception as e:
                logger.error(f"❌ Failed to initialize Supabase client: {str(e)}")
                logger.warning("Continuing without Supabase integration - data will only be stored in memory")
                self.supabase = None
                
                # Let's also try to understand what's happening
                logger.info("💡 Supabase integration disabled. You can still use the application with in-memory storage.")
                logger.info("   Data will be available during the current session but will be lost on restart.")
        else:
            logger.warning("⚠️ Supabase not available or not configured")
    
    async def create_job(self, job_id: str, job_data: Dict[str, Any]) -> bool:
        """Store job in Supabase"""
        if not self.supabase:
            return False
        
        try:
            data = {
                "id": job_id,
                "job_role": job_data["job_role"],
                "job_description": job_data["description"],
                "required_experience": job_data["required_experience"],
                "status": "active",
                "job_description_analysis": None,
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat()
            }
            
            result = self.supabase.table("job_posts").insert(data).execute()
            if result.data:
                logger.info(f"✅ Job {job_id} stored in Supabase")
                return True
            else:
                logger.error(f"❌ Failed to store job {job_id} in Supabase")
                return False
        except Exception as e:
            logger.error(f"❌ Error storing job in Supabase: {str(e)}")
            return False
    
    async def update_job_analysis(self, job_id: str, analysis: Dict[str, Any]) -> bool:
        """Update job analysis in Supabase"""
        if not self.supabase:
            return False
        
        try:
            result = self.supabase.table("job_posts").update({
                "job_description_analysis": analysis,
                "updated_at": datetime.utcnow().isoformat()
            }).eq("id", job_id).execute()
            
            if result.data:
                logger.info(f"✅ Job analysis updated for {job_id} in Supabase")
                return True
            else:
                logger.error(f"❌ Failed to update job analysis for {job_id} in Supabase")
                return False
        except Exception as e:
            logger.error(f"❌ Error updating job analysis in Supabase: {str(e)}")
            return False
    
    async def create_resume_result(self, job_id: str, resume_data: Dict[str, Any]) -> bool:
        """Store resume result in Supabase"""
        if not self.supabase:
            logger.warning(f"Supabase not available, skipping resume result storage for job {job_id}")
            return False
        
        try:
            logger.info(f"Attempting to store resume result for job {job_id}")
            logger.debug(f"Resume data keys: {list(resume_data.keys())}")
            
            # Map the data to Supabase schema
            data = {
                "id": resume_data.get("resume_id"),
                "job_post_id": job_id,
                "candidate_name": self._extract_candidate_name(resume_data),
                "candidate_type": resume_data.get("classification", {}).get("category", "tech"),
                "candidate_level": resume_data.get("classification", {}).get("level", "mid"),
                "fit_score": int(round(float(resume_data.get("fit_score", 0)))),  # Convert to integer
                "matching_skills": resume_data.get("matching_skills", []),
                "missing_skills": resume_data.get("missing_skills", []),
                "recommendation": resume_data.get("recommendation", "MANUAL_REVIEW"),
                "detailed_feedback": resume_data.get("detailed_analysis", {}).get("explanation", ""),
                "resume_analysis_data": resume_data.get("detailed_analysis", {}),
                "resume_file_name": resume_data.get("filename"),
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat()
            }
            
            logger.info(f"Mapped data for Supabase: candidate={data['candidate_name']}, score={data['fit_score']}")
            
            result = self.supabase.table("resume_results").insert(data).execute()
            if result.data:
                logger.info(f"✅ Resume result stored in Supabase for job {job_id} - candidate: {data['candidate_name']}")
                return True
            else:
                logger.error(f"❌ Failed to store resume result in Supabase for job {job_id} - no data returned")
                logger.error(f"Supabase error: {result}")
                return False
        except Exception as e:
            logger.error(f"❌ Error storing resume result in Supabase for job {job_id}: {str(e)}")
            logger.error(f"Full traceback: {traceback.format_exc()}")
            return False
    
    def _extract_candidate_name(self, resume_data: Dict[str, Any]) -> str:
        """Extract candidate name from resume data - now supports LLM extraction"""
        # First, try to get the extracted candidate name if it was already processed by LLM
        if "extracted_candidate_name" in resume_data:
            return str(resume_data["extracted_candidate_name"])[:255]
        
        # Try to extract from detailed analysis (legacy support)
        detailed = resume_data.get("detailed_analysis", {})
        
        # Look for name in various possible fields
        for field in ["candidate_name", "name", "applicant_name"]:
            if field in detailed and detailed[field]:
                return str(detailed[field])[:255]  # Limit to 255 chars
        
        # Fallback to filename without extension
        filename = resume_data.get("filename", "Unknown")
        if filename:
            name = filename.split(".")[0]  # Remove extension
            return name[:255]
        
        return "Unknown Candidate"

# Hybrid storage system
class HybridStore:
    """Hybrid storage using both in-memory and Supabase"""
    def __init__(self):
        self.memory_store = InMemoryStore()
        self.supabase_store = SupabaseStore()
    
    async def create_job(self, job_id: str, job_data: Dict[str, Any]) -> bool:
        """Store job in both memory and Supabase"""
        # Always store in memory for fast access
        self.memory_store.create_job(job_id, job_data)
        
        # Wait for Supabase storage to complete successfully
        try:
            supabase_success = await self.supabase_store.create_job(job_id, job_data)
            if not supabase_success:
                logger.error(f"❌ Failed to store job {job_id} in Supabase, removing from memory")
                # Remove from memory if Supabase storage failed
                if job_id in self.memory_store.jobs:
                    del self.memory_store.jobs[job_id]
                return False
            
            logger.info(f"✅ Job {job_id} successfully stored in both memory and Supabase")
            return True
        except Exception as e:
            logger.error(f"❌ Error storing job {job_id} in Supabase: {str(e)}, removing from memory")
            # Remove from memory if Supabase storage failed
            if job_id in self.memory_store.jobs:
                del self.memory_store.jobs[job_id]
            return False
    
    def update_job_analysis(self, job_id: str, analysis: Dict[str, Any]):
        """Update job analysis in both stores"""
        self.memory_store.update_job_analysis(job_id, analysis)
        asyncio.create_task(self.supabase_store.update_job_analysis(job_id, analysis))
    
    def add_resume_analysis(self, job_id: str, analysis: Dict[str, Any]):
        """Add resume analysis to both stores"""
        # Always store in memory first for immediate access
        self.memory_store.add_resume_analysis(job_id, analysis)
        
        # Store in Supabase with better error handling
        if self.supabase_store.supabase:
            try:
                # Create task and ensure it gets scheduled
                task = asyncio.create_task(self.supabase_store.create_resume_result(job_id, analysis))
                # Add done callback to log any errors
                task.add_done_callback(lambda t: self._handle_supabase_task_result(t, job_id, analysis))
            except Exception as e:
                logger.error(f"Failed to create Supabase storage task for job {job_id}: {str(e)}")
        else:
            logger.warning(f"Supabase not available, resume result for job {job_id} stored in memory only")
    
    def _handle_supabase_task_result(self, task: asyncio.Task, job_id: str, analysis: Dict[str, Any]):
        """Handle the result of Supabase storage task"""
        try:
            result = task.result()
            if result:
                logger.debug(f"Supabase storage successful for job {job_id}")
            else:
                logger.warning(f"Supabase storage failed for job {job_id}")
        except Exception as e:
            logger.error(f"Supabase storage task failed for job {job_id}: {str(e)}")
            # Optionally implement retry logic here
    
    def increment_total_resumes(self, job_id: str, count: int):
        """Increment total resume count (memory only for processing)"""
        self.memory_store.increment_total_resumes(job_id, count)
    
    def get_job(self, job_id: str) -> Optional[Dict[str, Any]]:
        """Get job data from memory"""
        return self.memory_store.get_job(job_id)
    
    def get_results(self, job_id: str, min_score: Optional[float] = None) -> List[Dict[str, Any]]:
        """Get results from memory"""
        return self.memory_store.get_results(job_id, min_score)
    
    def get_status(self, job_id: str) -> Dict[str, Any]:
        """Get processing status from memory"""
        return self.memory_store.get_status(job_id)

# Legacy InMemoryStore for backward compatibility
class InMemoryStore:
    """Simple in-memory storage for jobs and results"""
    def __init__(self):
        self.jobs = {}
        self.resume_analyses = defaultdict(list)
        self.processing_status = defaultdict(lambda: {"total": 0, "processed": 0})
        # Add interview setups storage
        self.interview_setups = defaultdict(list)  # job_id -> list of setups
    
    def create_job(self, job_id: str, job_data: Dict[str, Any]):
        """Store job data"""
        self.jobs[job_id] = {
            **job_data,
            "created_at": datetime.utcnow().isoformat(),
            "analysis": None
        }
    
    def update_job_analysis(self, job_id: str, analysis: Dict[str, Any]):
        """Update job analysis"""
        if job_id in self.jobs:
            self.jobs[job_id]["analysis"] = analysis
    
    def add_resume_analysis(self, job_id: str, analysis: Dict[str, Any]):
        """Add resume analysis result"""
        self.resume_analyses[job_id].append(analysis)
        self.processing_status[job_id]["processed"] += 1
    
    def increment_total_resumes(self, job_id: str, count: int):
        """Increment total resume count"""
        self.processing_status[job_id]["total"] += count
    
    def get_job(self, job_id: str) -> Optional[Dict[str, Any]]:
        """Get job data"""
        return self.jobs.get(job_id)
    
    def get_results(self, job_id: str, min_score: Optional[float] = None) -> List[Dict[str, Any]]:
        """Get results for a job"""
        results = self.resume_analyses.get(job_id, [])
        if min_score:
            results = [r for r in results if r.get("fit_score", 0) >= min_score]
        return sorted(results, key=lambda x: x.get("fit_score", 0), reverse=True)
    
    def get_status(self, job_id: str) -> Dict[str, Any]:
        """Get processing status"""
        return self.processing_status.get(job_id, {"total": 0, "processed": 0})
    
    # Interview setup methods
    def create_interview_setup(self, job_id: str, setup_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create interview setup configuration"""
        # Generate unique ID
        setup_id = str(uuid.uuid4())
        setup = {
            "id": setup_id,
            "job_post_id": job_id,
            **setup_data,
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
            "is_active": True
        }
        
        # Deactivate existing setups for same role_type/level if replace mode
        for existing_setup in self.interview_setups[job_id]:
            if (existing_setup.get("role_type") == setup_data.get("role_type") and 
                existing_setup.get("level") == setup_data.get("level") and 
                existing_setup.get("is_active", True)):
                existing_setup["is_active"] = False
                existing_setup["updated_at"] = datetime.utcnow().isoformat()
        
        self.interview_setups[job_id].append(setup)
        return setup
    
    def get_interview_setups(self, job_id: str) -> List[Dict[str, Any]]:
        """Get active interview setups for a job"""
        return [setup for setup in self.interview_setups[job_id] if setup.get("is_active", True)]
    
    def deactivate_all_interview_setups(self, job_id: str):
        """Deactivate all interview setups for a job"""
        for setup in self.interview_setups[job_id]:
            setup["is_active"] = False
            setup["updated_at"] = datetime.utcnow().isoformat()

# Initialize storage
storage = HybridStore()

# Pydantic Models
class JobDescriptionInput(BaseModel):
    job_role: str = Field(..., min_length=1, max_length=255)
    required_experience: str = Field(..., min_length=1, max_length=100)
    description: str = Field(..., min_length=10, max_length=10000)
    
    @field_validator('description')
    @classmethod
    def validate_description(cls, v):
        if len(v.split()) < 10:
            raise ValueError('Job description must contain at least 10 words')
        return v

class ResumeClassification(BaseModel):
    category: str  # tech, non-tech, semi-tech
    level: str     # entry, mid, senior
    confidence: float

class ResumeAnalysisResult(BaseModel):
    resume_id: str
    filename: str
    classification: ResumeClassification
    fit_score: float
    matching_skills: List[str]
    missing_skills: List[str]
    recommendation: str
    detailed_analysis: Dict[str, Any]

# Azure OpenAI Client
class AzureOpenAIClient:
    """Wrapper for Azure OpenAI with rate limiting and error handling"""
    
    def __init__(self):
        self.client = AzureOpenAI(
            api_key=Config.AZURE_OPENAI_API_KEY,
            api_version=Config.AZURE_OPENAI_API_VERSION,
            azure_endpoint=Config.AZURE_OPENAI_ENDPOINT
        )
        self.encoding = tiktoken.encoding_for_model("gpt-4")
        self.rate_limiter = asyncio.Semaphore(Config.MAX_CONCURRENT_REQUESTS)
        
    def count_tokens(self, text: str) -> int:
        """Count tokens in text"""
        return len(self.encoding.encode(text))
    
    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=4, max=10))
    async def complete(self, messages: List[Dict[str, str]], temperature: float = 0.1, max_tokens: int = None) -> str:
        """Make completion request with retry logic"""
        if max_tokens is None:
            max_tokens = Config.MAX_TOKENS_PER_REQUEST
            
        async with self.rate_limiter:
            try:
                response = await asyncio.to_thread(
                    self.client.chat.completions.create,
                    model=Config.AZURE_OPENAI_DEPLOYMENT,
                    messages=messages,
                    temperature=temperature,
                    max_tokens=max_tokens if max_tokens else Config.MAX_TOKENS_PER_REQUEST
                )
                
                # Extract content and validate
                content = response.choices[0].message.content
                if content is None:
                    logger.error("OpenAI returned null content")
                    raise ValueError("OpenAI returned null content")
                
                # Log response details for debugging
                logger.info(f"OpenAI response received - Content length: {len(content)}")
                logger.debug(f"Response content preview: {content[:100] if content else 'EMPTY'}...")
                
                return content
                
            except Exception as e:
                logger.error(f"Azure OpenAI API error: {str(e)}")
                logger.error(f"Error details: {traceback.format_exc()}")
                raise

class ElevenLabsService:
    """Utility class to fetch full conversation transcript from ElevenLabs API"""

    BASE_URL = "https://api.elevenlabs.io/v1"

    @staticmethod
    def fetch_transcript(conversation_id: str, api_key: str) -> Tuple[str, datetime, datetime]:
        """Return (transcript_text, started_at, ended_at)"""
        headers = {"xi-api-key": api_key}
        url = f"{ElevenLabsService.BASE_URL}/conversations/{conversation_id}/messages?limit=1000"

        response = requests.get(url, headers=headers, timeout=15)
        response.raise_for_status()
        data = response.json()

        messages = data.get("messages", [])
        if not messages:
            return "", datetime.utcnow(), datetime.utcnow()

        lines = []
        first_ts = None
        last_ts = None
        for m in messages:
            ts = datetime.fromisoformat(m["created_at"].replace("Z", "+00:00"))
            first_ts = first_ts or ts
            last_ts = ts
            prefix = "AI" if m.get("source") == "ai" else "USER"
            lines.append(f"{prefix}: {m.get('message')}")

        transcript_text = "\n".join(lines)
        return transcript_text, first_ts, last_ts

class InterviewAnalyzer:
    """Analyse interview transcript with GPT and return structured scores/info"""

    def __init__(self, openai_client: AzureOpenAIClient):
        self.openai_client = openai_client

    async def _parse_transcript_qa_pairs(self, transcript: str) -> List[Dict[str, str]]:
        """Extract question-answer pairs from transcript, including unanswered questions"""
        qa_pairs = []
        lines = transcript.split('\n')
        current_question = None
        current_answer = []
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
                
            # Check if it's an AI/interviewer line (question)
            if line.startswith(('AI:', 'AGENT:', 'INTERVIEWER:')):
                # Save previous Q&A pair if exists (even if no answer)
                if current_question:
                    qa_pairs.append({
                        "question": current_question,
                        "answer": ' '.join(current_answer).strip() if current_answer else ""
                    })
                # Start new question
                current_question = line.split(':', 1)[1].strip() if ':' in line else line
                current_answer = []
            # Check if it's a user/candidate line (answer)
            elif line.startswith(('USER:', 'CANDIDATE:', 'YOU:')):
                answer_text = line.split(':', 1)[1].strip() if ':' in line else line
                current_answer.append(answer_text)
            # Continue previous answer if no prefix
            elif current_answer:
                current_answer.append(line)
        
        # Don't forget the last Q&A pair (even if no answer)
        if current_question:
            qa_pairs.append({
                "question": current_question,
                "answer": ' '.join(current_answer).strip() if current_answer else ""
            })
        
        return qa_pairs
    
    def _is_greeting_question(self, question: str) -> bool:
        """Check if a question is a greeting/welcome message that shouldn't be counted"""
        greeting_patterns = [
            "hello",
            "welcome",
            "i'm excited to learn",
            "are you ready to begin",
            "ready to start",
            "shall we begin",
            "let's get started",
            "nice to meet you",
            "good morning",
            "good afternoon",
            "good evening",
            "how are you today",
            "thank you for joining"
        ]
        question_lower = question.lower()
        return any(pattern in question_lower for pattern in greeting_patterns)
    
    def _is_followup_question(self, question: str) -> bool:
        """Check if a question is a follow-up question that shouldn't be scored"""
        followup_patterns = [
            "can you elaborate",
            "could you elaborate",
            "please elaborate",
            "tell me more",
            "can you explain more",
            "give an example",
            "provide an example",
            "can you give me an example",
            "could you provide more details",
            "can you be more specific",
            "anything else",
            "what else",
            "continue",
            "go on",
            "please continue"
        ]
        question_lower = question.lower()
        return any(pattern in question_lower for pattern in followup_patterns)
    
    def _is_skipped_answer(self, answer: str) -> bool:
        """Check if an answer indicates the candidate skipped or couldn't answer"""
        if not answer or len(answer.strip()) == 0:
            return True
            
        skip_patterns = [
            "i don't know",
            "i dont know",
            "not sure",
            "can't answer",
            "cannot answer",
            "skip",
            "pass",
            "no idea",
            "i'm not familiar",
            "im not familiar",
            "i haven't",
            "i havent",
            "unable to answer"
        ]
        answer_lower = answer.lower().strip()
        return any(pattern in answer_lower for pattern in skip_patterns)
    
    def _get_difficulty_multiplier(self, difficulty: str) -> float:
        """Get the multiplier based on question difficulty"""
        multipliers = {
            "easy": 1.0,
            "medium": 1.2,
            "hard": 1.5,
            "very_hard": 1.5  # Treating very_hard same as hard
        }
        return multipliers.get(difficulty.lower(), 1.0)

    async def analyse(self, transcript: str, candidate_name: str, job_role: str, interview_questions: List[Dict] = None) -> Dict[str, Any]:
        # Extract Q&A pairs from transcript
        qa_pairs = await self._parse_transcript_qa_pairs(transcript)
        
        # New weighted scoring system prompt
        system_prompt = (
            "You are an AI talent-acquisition assistant analyzing a job interview. "
            "Score each question-answer pair individually focusing on domain/technical knowledge.\n\n"
            "SCORING CRITERIA:\n"
            "0 = No answer/Skipped/Unable to answer/Empty response\n"
            "1 = Incorrect or irrelevant\n"
            "2 = Vague or incomplete\n"
            "3 = Partially correct or shallow\n"
            "4 = Mostly correct, some minor gaps\n"
            "5 = Complete, accurate, in-depth, contextual\n\n"
            "SPECIAL HANDLING:\n"
            "- If the candidate didn't answer, skipped, or said they don't know: score = 0\n"
            "- Empty or missing answers: score = 0\n"
            "- 'I don't know' or equivalent responses: score = 0\n\n"
            "IMPORTANT: Return ONLY raw JSON without any markdown formatting or code fences.\n"
            "Do NOT wrap the response in ```json``` or any other formatting.\n"
            "Return ONLY valid JSON matching this schema EXACTLY:\n"
            "{\n"
            "  \"question_scores\": {\n"
            "    \"questions\": [\n"
            "      {\n"
            "        \"question\": \"The question text\",\n"
            "        \"answer\": \"The candidate's answer\",\n"
            "        \"score\": 0-5,\n"
            "        \"scoring_rationale\": \"Explanation of why this score was given\",\n"
            "        \"is_domain_question\": boolean,\n"
            "        \"is_followup_question\": boolean,\n"
            "        \"is_initial_question\": boolean\n"
            "      }\n"
            "    ],\n"
            "    \"total_questions\": int,\n"
            "    \"domain_questions_count\": int,\n"
            "    \"scorable_questions_count\": int\n"
            "  },\n"
            "  \"communication_score\": int (0-100),\n"
            "  \"communication_analysis\": {\n"
            "    \"clarity\": \"Excellent|Good|Average|Poor\",\n"
            "    \"articulation\": \"Very Clear|Clear|Somewhat Clear|Unclear\",\n"
            "    \"confidence\": \"High|Medium|Low\",\n"
            "    \"language_proficiency\": \"Native|Fluent|Proficient|Basic\"\n"
            "  },\n"
            "  \"domain_knowledge_insights\": \"Detailed analysis of technical/domain understanding\",\n"
            "  \"technical_competency_analysis\": {\n"
            "    \"strengths\": [\"List of strengths\"],\n"
            "    \"weaknesses\": [\"List of weaknesses\"],\n"
            "    \"depth_rating\": \"Expert|Advanced|Intermediate|Beginner\"\n"
            "  },\n"
            "  \"problem_solving_approach\": \"Assessment of problem-solving methodology\",\n"
            "  \"relevant_experience_assessment\": \"Analysis of experience alignment\",\n"
            "  \"knowledge_gaps\": [\"Areas needing improvement\"],\n"
            "  \"interview_performance_metrics\": {\n"
            "    \"response_quality\": \"Excellent|Good|Average|Poor\",\n"
            "    \"technical_accuracy\": \"Highly Accurate|Mostly Accurate|Partially Accurate|Inaccurate\",\n"
            "    \"examples_provided\": \"Rich Examples|Some Examples|Few Examples|No Examples\",\n"
            "    \"clarity_of_explanation\": \"Very Clear|Clear|Somewhat Clear|Unclear\"\n"
            "  },\n"
            "  \"areas_of_improvement\": [\"Specific improvement areas\"],\n"
            "  \"system_recommendation\": \"Strong Hire|Hire|Maybe|No Hire\"\n"
            "}\n\n"
            "SCORING RULES:\n"
            "1. Score each Q&A pair from 0-5 based on the criteria\n"
            "2. Give score=0 for: empty answers, 'I don't know', skipped questions, or no response\n"
            "3. Exclude greeting/welcome messages (Hello, Welcome, Are you ready to begin, etc.) from scoring\n"
            "4. Mark questions as domain questions if they test technical/job-specific knowledge\n"
            "5. Mark FIRST question as is_initial_question=true and is_followup_question=false\n"
            "6. Mark follow-up questions (elaborate, give example, etc.) as is_followup_question=true\n"
            "7. For follow-up questions: Score the follow-up as it represents the final answer to the main question\n"
            "7. Score ALL actual interview questions including follow-ups\n"
            "8. Focus evaluation on technical competency and domain expertise\n"
            "9. Respond ONLY with valid JSON, no additional text or formatting."
        )
        
        # Format Q&A pairs for scoring
        qa_text = ""
        for i, qa in enumerate(qa_pairs, 1):
            qa_text += f"\nQ{i}: {qa['question']}\nA{i}: {qa['answer']}\n"
        
            user_prompt = (
                f"Candidate: {candidate_name}\nRole interviewed for: {job_role}\n\n"
            f"Score each question-answer pair below using the 0-5 criteria.\n"
            f"IMPORTANT: \n"
            f"- Give score=0 for empty answers, 'I don't know', or skipped questions\n"
            f"- DO NOT score greeting/welcome messages (Hello, Welcome, Are you ready to begin, etc.)\n"
            f"- For follow-up questions: Score the follow-up answer as the final answer to the main question\n"
            f"- Only score actual interview questions that test knowledge or skills\n"
            f"- FIRST question should ALWAYS be marked as is_initial_question=true and is_followup_question=false\n"
            f"Identify which questions test domain/technical knowledge (is_domain_question=true).\n"
            f"Mark follow-up questions (elaborate, example, tell more) as is_followup_question=true.\n"
            f"Score ALL actual interview questions including follow-ups.\n"
            f"Analyze communication skills separately based on overall language use, clarity, and confidence.\n\n"
            f"QUESTION-ANSWER PAIRS ({len(qa_pairs)} total):\n"
            f"{qa_text}\n\n"
            f"ADDITIONAL CONTEXT - Full Transcript:\n{transcript}"
            )

        content = await self.openai_client.complete([
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ], temperature=0.1, max_tokens=16000)  # Max tokens for gpt-4o is 16384

        try:
            logger.info(f"📊 Azure OpenAI response length: {len(content)} characters")
            
            # Clean the response - remove any markdown formatting (matching job analysis pattern)
            cleaned_content = content.strip()
            if cleaned_content.startswith('```json'):
                cleaned_content = cleaned_content[7:]  # Remove ```json
            elif cleaned_content.startswith('```'):
                cleaned_content = cleaned_content[3:]  # Remove ```
            if cleaned_content.endswith('```'):
                cleaned_content = cleaned_content[:-3]  # Remove ```
            cleaned_content = cleaned_content.strip()
            
            logger.info(f"Cleaned response preview: {cleaned_content[:200]}...")
            
            analysis = json.loads(cleaned_content)
            
            # Calculate weighted scores based on difficulty
            if "question_scores" in analysis and interview_questions:
                questions_data = analysis["question_scores"]["questions"]
                
                # Map interview questions by their text for difficulty lookup
                question_difficulty_map = {}
                for iq in interview_questions:
                    if "question" in iq and "difficulty" in iq:
                        question_difficulty_map[iq["question"].lower()] = iq.get("difficulty", "medium")
                
                # Calculate raw score and max score
                raw_score = 0
                max_score = 0
                domain_raw_score = 0
                domain_max_score = 0
                last_main_question_index = -1
                followup_counted_for_main = set()  # Track which main questions already have a follow-up scored
                
                for i, q in enumerate(questions_data):
                    # Check if it's a greeting/welcome message
                    is_greeting = self._is_greeting_question(q["question"])
                    q["is_greeting"] = is_greeting
                    
                    # FIRST QUESTION LOGIC: Never mark first question as follow-up, always mark as initial
                    if i == 0:
                        q["is_followup_question"] = False
                        q["is_initial_question"] = True
                        is_followup = False
                    else:
                        # Check if it's a follow-up question (only for non-first questions)
                        is_followup = self._is_followup_question(q["question"])
                        q["is_followup_question"] = is_followup
                        q["is_initial_question"] = False
                    
                    # Exclude greetings from scoring
                    if is_greeting:
                        q["excluded_from_scoring"] = True
                        q["exclusion_reason"] = "Greeting/welcome message, not an interview question"
                        continue
                    
                    # Track main questions
                    if not is_followup:
                        last_main_question_index = i
                    
                    # For follow-ups, replace the main question's score and exclude the main question
                    if is_followup and last_main_question_index >= 0:
                        if last_main_question_index in followup_counted_for_main:
                            q["excluded_from_scoring"] = True
                            q["exclusion_reason"] = "Already scored one follow-up for this main question"
                            continue
                        else:
                            # Mark the main question as excluded since follow-up will replace it
                            main_question = questions_data[last_main_question_index]
                            main_question["excluded_from_scoring"] = True
                            main_question["exclusion_reason"] = "Score replaced by follow-up question"
                            
                            followup_counted_for_main.add(last_main_question_index)
                            q["excluded_from_scoring"] = False
                            q["replaces_main_question"] = True
                    
                    # Get difficulty from the original question
                    question_lower = q["question"].lower()
                    difficulty = "medium"  # Default
                    
                    # Try to match with original questions
                    for orig_q, diff in question_difficulty_map.items():
                        if orig_q in question_lower or question_lower in orig_q:
                            difficulty = diff
                            break
                    
                    # For follow-up questions, use the same difficulty as the main question
                    if is_followup and last_main_question_index >= 0:
                        main_q = questions_data[last_main_question_index]
                        if "difficulty" in main_q:
                            difficulty = main_q["difficulty"]
                    
                    multiplier = self._get_difficulty_multiplier(difficulty)
                    q["difficulty"] = difficulty
                    q["difficulty_multiplier"] = multiplier
                    
                    # Calculate weighted score
                    score = q.get("score", 0)
                    weighted_score = score * multiplier
                    q["weighted_score"] = weighted_score
                    
                    # Add to totals
                    raw_score += weighted_score
                    max_score += 5 * multiplier  # Max score is 5 * multiplier
                    
                    # If it's a domain question, add to domain totals
                    if q.get("is_domain_question", False):
                        domain_raw_score += weighted_score
                        domain_max_score += 5 * multiplier
                
                # Calculate scorable questions before handling abandoned interviews
                scorable_questions = [q for q in questions_data if not q.get("excluded_from_scoring", False)]
                
                # Handle abandoned interviews - add remaining questions to max score
                total_expected_questions = 7
                questions_asked = len(scorable_questions)
                
                if questions_asked < total_expected_questions:
                    # Add remaining questions with medium difficulty (1.2x) to max score
                    remaining_questions = total_expected_questions - questions_asked
                    medium_multiplier = 1.2
                    max_score += remaining_questions * 5 * medium_multiplier
                    
                    # Add abandoned questions to the questions list for transparency
                    for i in range(remaining_questions):
                        abandoned_question = {
                            "question": f"[Question {questions_asked + i + 1} - Not Asked Due to Interview Ending]",
                            "answer": "[Interview Ended]",
                            "score": 0,
                            "scoring_rationale": "Interview ended before this question could be asked",
                            "is_domain_question": True,  # Assume domain questions for max score calculation
                            "is_followup_question": False,
                            "difficulty": "medium",
                            "difficulty_multiplier": medium_multiplier,
                            "weighted_score": 0,
                            "is_abandoned": True
                        }
                        questions_data.append(abandoned_question)
                        domain_max_score += 5 * medium_multiplier
                
                # Calculate normalized scores
                normalized_score = (raw_score / max_score * 100) if max_score > 0 else 0
                normalized_domain_score = (domain_raw_score / domain_max_score * 100) if domain_max_score > 0 else 0
                
                # Store calculated values
                analysis["raw_domain_score"] = round(domain_raw_score, 2)
                analysis["max_domain_score"] = round(domain_max_score, 2)
                analysis["normalized_domain_score"] = round(normalized_domain_score, 2)
                
                # Overall score = 80% from normalized domain score + 20% from communication
                communication_score = analysis.get("communication_score", 50)
                analysis["overall_score"] = int(normalized_domain_score * 0.8 + communication_score * 0.2)
                analysis["domain_score"] = int(normalized_domain_score)
                
                # Add summary to question_scores
                # scorable_questions already calculated above
                domain_questions = [q for q in scorable_questions if q.get("is_domain_question", False)]
                
                analysis["question_scores"]["scorable_questions_count"] = len(scorable_questions)
                analysis["question_scores"]["raw_score"] = round(raw_score, 2)
                analysis["question_scores"]["max_score"] = round(max_score, 2)
                analysis["question_scores"]["normalized_score"] = round(normalized_score, 2)
                
                # Remove behavioral_score from the analysis if it exists
                analysis.pop("behavioral_score", None)
            
            # Ensure all required fields have meaningful content
            if not analysis.get("domain_knowledge_insights") or len(analysis.get("domain_knowledge_insights", "")) < 50:
                analysis["domain_knowledge_insights"] = (
                    f"Based on the interview responses, the candidate demonstrated understanding of {job_role} concepts. "
                    f"Their domain knowledge appears to be at a foundational level with room for growth in specialized areas. "
                    f"Further assessment would benefit from more technical deep-dive questions."
                )
            
            if not analysis.get("problem_solving_approach") or len(analysis.get("problem_solving_approach", "")) < 50:
                analysis["problem_solving_approach"] = (
                    "The candidate's problem-solving approach shows structured thinking with a preference for systematic analysis. "
                    "They demonstrate the ability to break down complex problems into manageable components, though more examples "
                    "of innovative solutions would strengthen their profile."
                )
            
            if not analysis.get("relevant_experience_assessment") or len(analysis.get("relevant_experience_assessment", "")) < 50:
                analysis["relevant_experience_assessment"] = (
                    f"The candidate's experience shows some alignment with the {job_role} position requirements. "
                    "They have demonstrated transferable skills that could be valuable in this role, though direct experience "
                    "in certain key areas may be limited."
                )
            
            # Ensure technical_competency_analysis has proper structure
            if not analysis.get("technical_competency_analysis") or not isinstance(analysis.get("technical_competency_analysis"), dict):
                analysis["technical_competency_analysis"] = {
                    "strengths": ["Communication skills", "Willingness to learn", "Basic technical understanding"],
                    "weaknesses": ["Limited hands-on experience", "Needs deeper technical knowledge"],
                    "depth_rating": "Intermediate"
                }
            
            # Ensure knowledge_gaps is a list
            if not analysis.get("knowledge_gaps") or not isinstance(analysis.get("knowledge_gaps"), list):
                analysis["knowledge_gaps"] = ["Advanced technical concepts", "Industry-specific best practices", "Specialized tools and frameworks"]
            
            # Ensure interview_performance_metrics has proper structure
            if not analysis.get("interview_performance_metrics") or not isinstance(analysis.get("interview_performance_metrics"), dict):
                analysis["interview_performance_metrics"] = {
                    "response_quality": "Good",
                    "technical_accuracy": "Mostly Accurate",
                    "examples_provided": "Some Examples",
                    "clarity_of_explanation": "Clear"
                }
            
            # Remove any behavioral-related fields that might have been included
            fields_to_remove = ["behavioral_score", "confidence_level", "cheating_detected", "body_language", "speech_pattern"]
            for field in fields_to_remove:
                analysis.pop(field, None)
            
            return analysis
        except json.JSONDecodeError as e:
            logger.error("Failed to parse GPT analysis JSON. Error: %s", str(e))
            logger.error("Response length: %d characters", len(content) if content else 0)
            logger.error("First 100 characters: %s", content[:100] if content else "EMPTY RESPONSE")
            logger.error("Last 200 characters: %s", content[-200:] if content else "EMPTY RESPONSE")
            
            # Check for common issues
            if not content:
                raise Exception("Interview analysis failed: Azure OpenAI returned empty response")
            elif content.strip().startswith("I") or content.strip().startswith("The"):
                raise Exception("Interview analysis failed: Azure OpenAI returned conversational text instead of JSON")
            else:
                raise Exception(f"Interview analysis failed: Unable to parse Azure OpenAI JSON response. {str(e)}")
        except Exception as e:
            logger.error("Unexpected error during interview analysis: %s", str(e))
            raise Exception(f"Interview analysis failed: {str(e)}")

# Candidate Name Extractor
class CandidateNameExtractor:
    """Extract candidate names from resumes using LLM"""
    
    def __init__(self, openai_client: AzureOpenAIClient):
        self.openai_client = openai_client
    
    async def extract_candidate_name(self, resume_text: str, filename: str = "") -> str:
        """Extract the candidate's full name from resume text using Azure OpenAI"""
        
        try:
            # Limit resume text to first 1000 characters to focus on header section
            # where names are typically located
            resume_preview = resume_text[:1000] if resume_text else ""
            
            prompt = f"""
            Extract the candidate's full name from the following resume text. 
            
            RESUME TEXT:
            {resume_preview}
            
            FILENAME (for reference): {filename}
            
            INSTRUCTIONS:
            1. Identify the candidate's full name (first name and last name)
            2. Return ONLY the clean, properly formatted name
            3. Remove any titles (Mr., Ms., Dr., etc.)
            4. Remove any extra formatting or symbols
            5. Capitalize properly (Title Case)
            6. If multiple names appear, return the main candidate's name (usually at the top)
            7. If no clear name is found, analyze the filename as backup
            
            EXAMPLES:
            - "NIKHIL PATEL" → "Nikhil Patel"
            - "chandan kumar gupta" → "Chandan Kumar Gupta" 
            - "John Smith, MBA" → "John Smith"
            - "Dr. Sarah Johnson" → "Sarah Johnson"
            
            Return ONLY the extracted name, nothing else.
            """
            
            messages = [
                {"role": "system", "content": "You are an expert at extracting candidate names from resumes. You must return ONLY the candidate's clean, properly formatted full name with no additional text, explanations, or formatting."},
                {"role": "user", "content": prompt}
            ]
            
            response = await self.openai_client.complete(messages, temperature=0.1)
            
            if response:
                # Clean the response
                extracted_name = response.strip()
                
                # Remove any markdown formatting or quotes
                extracted_name = extracted_name.replace('"', '').replace("'", "").strip()
                
                # Remove common prefixes that might remain
                prefixes_to_remove = ['Name:', 'Candidate:', 'Full Name:', 'The candidate is:', 'The name is:']
                for prefix in prefixes_to_remove:
                    if extracted_name.lower().startswith(prefix.lower()):
                        extracted_name = extracted_name[len(prefix):].strip()
                
                # Ensure proper title case
                extracted_name = extracted_name.title()
                
                # Validate the extracted name (should have at least first and last name)
                name_parts = extracted_name.split()
                if len(name_parts) >= 2 and all(part.isalpha() or part.replace("'", "").isalpha() for part in name_parts):
                    logger.info(f"✅ Successfully extracted candidate name: '{extracted_name}' from resume")
                    return extracted_name[:255]  # Limit to 255 chars for database
                else:
                    logger.warning(f"⚠️ Extracted name '{extracted_name}' doesn't look valid, falling back to filename")
                    return self._extract_name_from_filename(filename)
            else:
                logger.warning("⚠️ Empty response from OpenAI for name extraction")
                return self._extract_name_from_filename(filename)
                
        except Exception as e:
            logger.error(f"❌ Error extracting candidate name using LLM: {str(e)}")
            return self._extract_name_from_filename(filename)
    
    def _extract_name_from_filename(self, filename: str) -> str:
        """Fallback method to extract name from filename"""
        if not filename:
            return "Unknown Candidate"
        
        try:
            # Remove extension
            name = filename.split(".")[0]
            
            # Remove common resume-related words
            words_to_remove = ['cv', 'resume', 'curriculum', 'vitae', 'updated', 'new', 'final', 'latest']
            
            # Split by common delimiters
            name_parts = re.split(r'[-_\s()[\]{}]+', name.lower())
            
            # Filter out numbers, common words, and empty parts
            filtered_parts = []
            for part in name_parts:
                if (part.isalpha() and 
                    len(part) > 1 and 
                    part not in words_to_remove and
                    not part.isdigit()):
                    filtered_parts.append(part.title())
            
            if len(filtered_parts) >= 2:
                # Take first two parts as first and last name
                extracted_name = " ".join(filtered_parts[:2])
                logger.info(f"📁 Extracted name from filename: '{extracted_name}'")
                return extracted_name[:255]
            elif len(filtered_parts) == 1:
                # Only one name part found
                extracted_name = filtered_parts[0]
                logger.info(f"📁 Extracted partial name from filename: '{extracted_name}'")
                return extracted_name[:255]
            else:
                # Fallback to cleaned filename
                cleaned_name = re.sub(r'[^a-zA-Z\s]', ' ', name).strip().title()
                if cleaned_name:
                    logger.info(f"📁 Using cleaned filename as name: '{cleaned_name}'")
                    return cleaned_name[:255]
                else:
                    return "Unknown Candidate"
                    
        except Exception as e:
            logger.error(f"❌ Error extracting name from filename '{filename}': {str(e)}")
            return "Unknown Candidate"

# Resume Parser
class ResumeParser:
    """Extract text from various resume formats"""
    
    @staticmethod
    def extract_text_from_pdf(file_content: bytes) -> str:
        """Extract text from PDF"""
        try:
            # Wrap bytes in BytesIO for PyPDF2
            file_stream = BytesIO(file_content)
            pdf_reader = PyPDF2.PdfReader(file_stream)
            text = ""
            for page in pdf_reader.pages:
                text += page.extract_text() + "\n"
            return text.strip()
        except Exception as e:
            logger.error(f"Error extracting PDF: {str(e)}")
            raise
    
    @staticmethod
    def extract_text_from_docx(file_content: bytes) -> str:
        """Extract text from DOCX"""
        try:
            # Wrap bytes in BytesIO for python-docx
            file_stream = BytesIO(file_content)
            doc = docx.Document(file_stream)
            text = "\n".join([paragraph.text for paragraph in doc.paragraphs])
            return text.strip()
        except Exception as e:
            logger.error(f"Error extracting DOCX: {str(e)}")
            raise
    
    @classmethod
    def extract_text(cls, file_content: bytes, filename: str) -> str:
        """Extract text based on file type"""
        if filename.lower().endswith('.pdf'):
            return cls.extract_text_from_pdf(file_content)
        elif filename.lower().endswith(('.docx', '.doc')):
            return cls.extract_text_from_docx(file_content)
        elif filename.lower().endswith('.txt'):
            return file_content.decode('utf-8', errors='ignore')
        else:
            raise ValueError(f"Unsupported file format: {filename}")

# Job Analyzer
class JobAnalyzer:
    """Analyze job descriptions using LLM"""
    
    def __init__(self, openai_client: AzureOpenAIClient):
        self.openai_client = openai_client
    
    async def analyze_job_description(self, job_role: str, required_experience: str, 
                                     description: str) -> Dict[str, Any]:
        """Extract skills and analyze job description"""
        
        prompt = f"""
        Analyze the following job description and extract key information:
        
        Job Role: {job_role}
        Required Experience: {required_experience}
        Description: {description}
        
        Please provide a comprehensive analysis in JSON format with the following structure:
        {{
            "required_skills": {{
                "technical": ["list of technical skills"],
                "soft": ["list of soft skills"],
                "domain": ["domain-specific skills"]
            }},
            "nice_to_have_skills": ["optional skills"],
            "key_responsibilities": ["main responsibilities"],
            "required_qualifications": ["education, certifications, etc."],
            "experience_requirements": {{
                "years": "extracted years of experience",
                "type": "type of experience needed"
            }},
            "technology_stack": ["specific technologies mentioned"],
            "industry_domain": "identified industry/domain",
            "job_category": "tech/non-tech/semi-tech classification"
        }}
        
        Be thorough and extract both explicit and implicit requirements.
        Respond ONLY with valid JSON, no additional text or formatting.
        """
        
        messages = [
            {"role": "system", "content": "You are an expert HR analyst specializing in job requirement extraction. You must respond with valid JSON only."},
            {"role": "user", "content": prompt}
        ]
        
        try:
            response = await self.openai_client.complete(messages)
            
            # Log the raw response for debugging
            logger.info(f"Raw OpenAI response length: {len(response) if response else 0}")
            if not response:
                logger.error("Empty response from OpenAI")
                raise ValueError("Empty response from OpenAI")
            
            # Clean the response - remove any markdown formatting
            cleaned_response = response.strip()
            if cleaned_response.startswith('```json'):
                cleaned_response = cleaned_response[7:]  # Remove ```json
            if cleaned_response.endswith('```'):
                cleaned_response = cleaned_response[:-3]  # Remove ```
            cleaned_response = cleaned_response.strip()
            
            logger.info(f"Cleaned response preview: {cleaned_response[:200]}...")
            
            try:
                analysis_data = json.loads(cleaned_response)
                logger.info("Successfully parsed job analysis JSON")
            except json.JSONDecodeError as e:
                logger.error(f"JSON decode error: {str(e)}")
                logger.error(f"Attempted to parse: {cleaned_response[:500]}...")
                
                # Fallback analysis
                analysis_data = {
                    "required_skills": {"technical": [], "soft": [], "domain": []},
                    "nice_to_have_skills": [],
                    "key_responsibilities": [],
                    "required_qualifications": [],
                    "experience_requirements": {"years": required_experience, "type": "general"},
                    "technology_stack": [],
                    "industry_domain": "general",
                    "job_category": "tech"
                }
                logger.warning("Using fallback job analysis due to JSON parsing error")
            
            return analysis_data
                
        except Exception as e:
            logger.error(f"Error in job analysis: {str(e)}")
            # Return fallback analysis
            return {
                "required_skills": {"technical": [], "soft": [], "domain": []},
                "nice_to_have_skills": [],
                "key_responsibilities": [],
                "required_qualifications": [],
                "experience_requirements": {"years": required_experience, "type": "general"},
                "technology_stack": [],
                "industry_domain": "general",
                "job_category": "tech"
            }

# Interview Question Generator
class InterviewQuestionGenerator:
    """Generate standardized interview questions based on job requirements using LLM"""
    
    def __init__(self, openai_client: AzureOpenAIClient):
        self.openai_client = openai_client
        self.adaptive_enabled = True  # Feature flag for adaptive interviews
    
    @staticmethod
    def determine_difficulty_level(resume_score: int) -> str:
        """
        Determine interview question difficulty level based on resume score
        
        Args:
            resume_score: Resume fit score (0-100)
            
        Returns:
            str: Difficulty level ('easy', 'medium', 'very_hard')
        """
        if resume_score <= 60:
            return 'easy'
        elif resume_score <= 70:
            return 'medium'
        else:
            return 'very_hard'
    
    @staticmethod
    def get_difficulty_description(difficulty_level: str) -> str:
        """Get human-readable description of difficulty level"""
        descriptions = {
            'easy': 'Basic level questions suitable for entry-level or candidates with lower fit scores',
            'medium': 'Intermediate level questions for moderately qualified candidates',
            'very_hard': 'Advanced level questions for highly qualified candidates'
        }
        return descriptions.get(difficulty_level, 'Standard level questions')
    
    async def generate_adaptive_question_pool(
        self,
        job_analysis: Dict[str, Any],
        evaluation_criteria: Dict[str, int],
        candidate_type: str,
        candidate_level: str,
        initial_difficulty: str
    ) -> Dict[str, Any]:
        """Generate a pool of questions at all difficulty levels for adaptive interviewing"""
        
        logger.info(f"🔄 Generating adaptive question pool with initial difficulty: {initial_difficulty}")
        
        # Calculate question distribution across categories
        question_distribution = self._distribute_questions(evaluation_criteria)
        total_base_questions = evaluation_criteria.get("number_of_questions", 7)
        
        # Initialize the question pool structure
        question_pool = {
            "screening": {"easy": [], "medium": [], "hard": []},
            "domain": {"easy": [], "medium": [], "hard": []},
            "behavioral": {"easy": [], "medium": [], "hard": []},
            "communication": {"easy": [], "medium": [], "hard": []}
        }
        
        # Generate questions for each category at each difficulty level
        all_generated_questions = {}
        
        for category, question_count in question_distribution.items():
            if question_count > 0:
                logger.info(f"📝 Generating {question_count} questions for {category} at all difficulty levels")
                
                for difficulty in ["easy", "medium", "hard"]:
                    # Generate questions for this specific category and difficulty
                    questions = await self._generate_questions_for_difficulty(
                        job_analysis=job_analysis,
                        category=category,
                        difficulty=difficulty,
                        count=question_count,
                        candidate_type=candidate_type,
                        candidate_level=candidate_level,
                        evaluation_criteria=evaluation_criteria
                    )
                    
                    question_pool[category][difficulty] = questions
                    all_generated_questions[f"{category}_{difficulty}"] = questions
        
        # Create adaptive configuration
        adaptive_config = {
            "initial_difficulty": initial_difficulty,
            "questions_per_category": question_distribution,
            "total_questions": total_base_questions,
            "adaptation_rules": {
                "struggle_indicators": [
                    "I don't know", "I'm not sure", "not familiar",
                    "can't remember", "unclear", "confused"
                ],
                "excellence_indicators": [
                    "furthermore", "additionally", "for example",
                    "specifically", "in my experience", "best practice",
                    "multiple approaches", "trade-offs"
                ],
                "downgrade_threshold": "Clear confusion or inability to answer",
                "upgrade_threshold": "Comprehensive answer with examples and depth"
            }
        }
        
        # Create the interview flow configuration
        interview_flow = {
            "total_questions": total_base_questions,
            "difficulty_progression": [],  # Will be filled during interview
            "categories_order": self._determine_category_order(question_distribution),
            "current_index": 0
        }
        
        logger.info(f"✅ Generated adaptive question pool: {sum(question_distribution.values())} base questions × 3 difficulty levels")
        
        return {
            "question_pool": question_pool,
            "adaptive_config": adaptive_config,
            "interview_flow": interview_flow,
            "success_criteria": f"Adaptive assessment across {', '.join([k for k,v in question_distribution.items() if v > 0])}",
            "estimated_duration": total_base_questions * 2  # 2 minutes per question
        }
    
    async def _generate_questions_for_difficulty(
        self,
        job_analysis: Dict[str, Any],
        category: str,
        difficulty: str,
        count: int,
        candidate_type: str,
        candidate_level: str,
        evaluation_criteria: Dict[str, int]
    ) -> List[Dict[str, Any]]:
        """Generate questions for a specific category and difficulty level"""
        
        difficulty_prompts = {
            "easy": "Basic, foundational questions suitable for entry-level understanding",
            "medium": "Intermediate questions requiring practical experience and application",
            "hard": "Advanced questions demanding deep expertise and strategic thinking"
        }
        
        prompt = f"""
        Generate exactly {count} {difficulty.upper()} difficulty {category} interview questions for a {candidate_type} {candidate_level} position.

        JOB REQUIREMENTS:
        {json.dumps(job_analysis, indent=2)}

        DIFFICULTY GUIDANCE ({difficulty}):
        {difficulty_prompts[difficulty]}

        CATEGORY: {category}
        - Screening: Verify basic qualifications and experience
        - Domain: Test technical/professional knowledge specific to the role
        - Behavioral: Assess soft skills, attitude, and cultural fit
        - Communication: Evaluate ability to explain and present ideas

        Generate questions that:
        1. Are specifically tailored to {difficulty} difficulty level
        2. Test {category} competencies
        3. Are relevant to the job requirements
        4. Progress logically if asked in sequence

        Respond with valid JSON array:
        [
            {{
                "id": "{category[0]}_{difficulty[0]}_1",
                "question": "Your question here",
                "focus_area": "Specific skill/competency being tested",
                "expected_depth": "{difficulty}",
                "evaluation_criteria": "What a good answer should include"
            }}
        ]
        """
        
        try:
            messages = [
                {"role": "system", "content": "You are an expert interview question designer."},
                {"role": "user", "content": prompt}
            ]
            
            response = await self.openai_client.complete(messages, temperature=0.7)
            
            # Debug: log the response to understand format
            logger.debug(f"OpenAI response for {difficulty} {category}: {response[:200]}...")
            
            # Try to extract JSON from response (it might be wrapped in text)
            try:
                # First try direct JSON parsing
                questions = json.loads(response)
            except json.JSONDecodeError:
                # Try to find JSON in the response text
                import re
                json_match = re.search(r'\[.*\]', response, re.DOTALL)
                if json_match:
                    questions = json.loads(json_match.group())
                else:
                    raise ValueError("No valid JSON found in response")
            
            # Add unique IDs and metadata
            for i, q in enumerate(questions):
                q["id"] = f"{category[0]}_{difficulty[0]}_{i+1}"
                q["category"] = category
                q["difficulty"] = difficulty
            
            return questions
            
        except Exception as e:
            logger.error(f"Error generating {difficulty} {category} questions: {str(e)}")
            # Return fallback questions
            return self._get_fallback_questions_for_category(category, difficulty, count)
    
    def _determine_category_order(self, distribution: Dict[str, int]) -> List[str]:
        """Determine the order of categories for the interview"""
        # Start with screening, then domain, behavioral, and communication
        order = []
        priority = ["screening", "domain", "behavioral", "communication"]
        
        for cat in priority:
            if distribution.get(cat, 0) > 0:
                order.append(cat)
        
        return order
    
    def _get_fallback_questions_for_category(self, category: str, difficulty: str, count: int) -> List[Dict[str, Any]]:
        """Get fallback questions if generation fails"""
        # Use the existing fallback questions and filter by category/difficulty
        all_fallbacks = self._generate_fallback_questions("", "", {category: count}, count, difficulty)
        return all_fallbacks.get("questions", [])
    
    def _distribute_questions(self, evaluation_criteria: Dict[str, int], total_questions: int = 7) -> Dict[str, int]:
        """Distribute questions based on percentage weights - strictly following percentages"""
        
        # Get percentages from criteria
        screening_percentage = evaluation_criteria.get('screening_percentage', 0)
        domain_percentage = evaluation_criteria.get('domain_percentage', 0)
        behavioral_percentage = evaluation_criteria.get('behavioral_attitude_percentage', 0)
        communication_percentage = evaluation_criteria.get('communication_percentage', 0)
        
        # Calculate questions per category based on percentages (strict - no forced minimums)
        screening_questions = round(screening_percentage / 100 * total_questions) if screening_percentage > 0 else 0
        domain_questions = round(domain_percentage / 100 * total_questions) if domain_percentage > 0 else 0
        behavioral_questions = round(behavioral_percentage / 100 * total_questions) if behavioral_percentage > 0 else 0
        communication_questions = round(communication_percentage / 100 * total_questions) if communication_percentage > 0 else 0
        
        # Calculate total allocated questions
        total_allocated = screening_questions + domain_questions + behavioral_questions + communication_questions
        
        # Handle edge case where all percentages are 0 or rounding results in 0 questions
        if total_allocated == 0:
            # If all percentages are 0, distribute questions proportionally among non-zero categories
            # or default to screening if all are truly 0
            if screening_percentage > 0:
                screening_questions = total_questions
            elif domain_percentage > 0:
                domain_questions = total_questions
            elif behavioral_percentage > 0:
                behavioral_questions = total_questions
            else:
                # Emergency fallback - shouldn't happen with proper validation
                screening_questions = total_questions
            total_allocated = total_questions
        
        # Adjust to ensure exactly the specified number of questions
        if total_allocated > total_questions:
            # Reduce questions from categories with allocated questions, starting with largest
            categories_to_reduce = []
            if screening_questions > 0:
                categories_to_reduce.append(('screening', screening_questions))
            if domain_questions > 0:
                categories_to_reduce.append(('domain', domain_questions))
            if behavioral_questions > 0:
                categories_to_reduce.append(('behavioral', behavioral_questions))
            if communication_questions > 0:
                categories_to_reduce.append(('communication', communication_questions))
            
            # Sort by question count (largest first)
            categories_to_reduce.sort(key=lambda x: x[1], reverse=True)
            
            excess = total_allocated - total_questions
            for i in range(excess):
                if categories_to_reduce:
                    category_name = categories_to_reduce[i % len(categories_to_reduce)][0]
                    if category_name == 'screening' and screening_questions > 0:
                        screening_questions -= 1
                    elif category_name == 'domain' and domain_questions > 0:
                        domain_questions -= 1
                    elif category_name == 'behavioral' and behavioral_questions > 0:
                        behavioral_questions -= 1
                    elif category_name == 'communication' and communication_questions > 0:
                        communication_questions -= 1
                    
        elif total_allocated < total_questions:
            # Add questions to categories with non-zero percentages, prioritizing largest percentage
            remaining = total_questions - total_allocated
            categories_to_add = []
            if screening_percentage > 0:
                categories_to_add.append(('screening', screening_percentage))
            if domain_percentage > 0:
                categories_to_add.append(('domain', domain_percentage))
            if behavioral_percentage > 0:
                categories_to_add.append(('behavioral', behavioral_percentage))
            if communication_percentage > 0:
                categories_to_add.append(('communication', communication_percentage))
            
            # Sort by percentage (largest first)
            categories_to_add.sort(key=lambda x: x[1], reverse=True)
            
            for i in range(remaining):
                if categories_to_add:
                    category_name = categories_to_add[i % len(categories_to_add)][0]
                    if category_name == 'screening':
                        screening_questions += 1
                    elif category_name == 'domain':
                        domain_questions += 1
                    elif category_name == 'behavioral':
                        behavioral_questions += 1
                    elif category_name == 'communication':
                        communication_questions += 1
        
        result = {
            'screening': screening_questions,
            'domain': domain_questions,
            'behavioral': behavioral_questions,
            'communication': communication_questions
        }
        
        # Log the distribution for debugging
        logger.info(f"Question distribution - Screening: {screening_questions} ({screening_percentage}%), "
                   f"Domain: {domain_questions} ({domain_percentage}%), "
                   f"Behavioral: {behavioral_questions} ({behavioral_percentage}%), "
                   f"Communication: {communication_questions} ({communication_percentage}%)")
        
        return result
    
    async def generate_standardized_questions(
        self, 
        job_analysis: Dict[str, Any], 
        evaluation_criteria: Dict[str, int],
        candidate_type: str,
        candidate_level: str,
        difficulty_level: str = 'medium'
    ) -> Dict[str, Any]:
        """Generate standardized interview questions based on job requirements only with specified difficulty level"""
        
        # Get the number of questions from evaluation criteria, default to 7
        total_questions = evaluation_criteria.get('number_of_questions', 7)
        
        # Get custom question template if provided
        question_template = evaluation_criteria.get('question_template', '').strip()
        
        # Distribute questions based on evaluation criteria
        question_distribution = self._distribute_questions(evaluation_criteria, total_questions)
        
        # Build requirements dynamically based on actual question distribution
        requirements = []
        requirements.append(f"Generate exactly {total_questions} standardized interview questions total")
        
        requirement_num = 1
        if question_distribution['screening'] > 0:
            requirements.append(f"{requirement_num}. Generate exactly {question_distribution['screening']} screening questions (basic qualifications, experience verification)")
            requirement_num += 1
        if question_distribution['domain'] > 0:
            requirements.append(f"{requirement_num}. Generate exactly {question_distribution['domain']} domain/technical questions (role-specific skills, technical depth)")
            requirement_num += 1
        if question_distribution['behavioral'] > 0:
            requirements.append(f"{requirement_num}. Generate exactly {question_distribution['behavioral']} behavioral questions (attitude, teamwork, problem-solving approach)")
            requirement_num += 1
        if question_distribution['communication'] > 0:
            requirements.append(f"{requirement_num}. Generate exactly {question_distribution['communication']} communication questions (clarity, presentation, explanation skills)")
            requirement_num += 1
        
        # Add general requirements
        requirements.extend([
            f"{requirement_num}. Tailor questions to the candidate's background and the job requirements",
            f"{requirement_num + 1}. Make questions specific and relevant to both the role and candidate's experience",
            f"{requirement_num + 2}. Ensure questions are appropriate for {candidate_level} level candidates",
            f"{requirement_num + 3}. STRICTLY follow the question distribution - do not generate questions for categories with 0 allocation"
        ])
        
        # Add custom template requirement if provided
        if question_template:
            requirements.append(f"{requirement_num + 4}. IMPORTANT: Follow the custom question template/instructions provided below for this specific role and level combination")
        
        requirements_text = "\n        ".join(requirements)
        
        # Build evaluation criteria display
        criteria_lines = []
        criteria_lines.append(f"- Screening: {evaluation_criteria.get('screening_percentage', 0)}% ({question_distribution['screening']} questions)")
        criteria_lines.append(f"- Domain/Technical: {evaluation_criteria.get('domain_percentage', 0)}% ({question_distribution['domain']} questions)")
        criteria_lines.append(f"- Behavioral/Attitude: {evaluation_criteria.get('behavioral_attitude_percentage', 0)}% ({question_distribution['behavioral']} questions)")
        criteria_lines.append(f"- Communication: {evaluation_criteria.get('communication_percentage', 0)}% ({question_distribution['communication']} questions)")
        criteria_text = "\n        ".join(criteria_lines)
        
        # Build custom template section if provided
        template_section = ""
        if question_template:
            template_section = f"""
        
        CUSTOM QUESTION TEMPLATE/INSTRUCTIONS for {candidate_type} {candidate_level}:
        {question_template}
        
        IMPORTANT: Integrate the above custom instructions into your question generation. This template should guide the style, focus areas, and specific topics to cover for this role and level combination."""
        
        difficulty_desc = self.get_difficulty_description(difficulty_level)
        
        prompt = f"""
        Generate exactly {total_questions} standardized interview questions for a {candidate_type} {candidate_level} position based on the job requirements:

        JOB ANALYSIS AND REQUIREMENTS:
        {json.dumps(job_analysis, indent=2)}

        DIFFICULTY LEVEL: {difficulty_level.upper()}
        {difficulty_desc}

        DIFFICULTY-SPECIFIC REQUIREMENTS:
        - For EASY level: Focus on foundational concepts, basic scenarios, and straightforward questions that test core understanding
        - For MEDIUM level: Include moderate complexity, some problem-solving scenarios, and practical applications
        - For VERY_HARD level: Design challenging scenarios, complex problem-solving, advanced technical depth, and strategic thinking

        EVALUATION CRITERIA (STRICT - DO NOT GENERATE QUESTIONS FOR 0% CATEGORIES):
        {criteria_text}{template_section}

        REQUIREMENTS:
        {requirements_text}

        IMPORTANT: 
        - Adjust question complexity according to the {difficulty_level.upper()} difficulty level specified above
        - Questions should be based ONLY on the job requirements and role expectations
        - Do NOT reference any specific candidate background or resume
        - Generate standardized questions that assess whether ANY candidate meets the job requirements at the specified difficulty level
        - Questions should be fair and consistent for all candidates applying for this role with similar qualification levels
        - If any category has 0 questions allocated, DO NOT generate any questions for that category
        - Ensure all questions align with the {difficulty_level} difficulty while remaining relevant to job requirements

        Respond with valid JSON in this exact format:
        {{
            "questions": [
                {{
                    "id": 1,
                    "category": "screening|domain|behavioral|communication",
                    "question": "Your role-based question here?",
                    "focus_area": "specific skill or area being evaluated",
                    "expected_depth": "entry|mid|senior level expected response depth"
                }}
            ],
            "interview_focus": "Overall focus areas for this interview",
            "success_criteria": "What makes a good response for this role and level",
            "total_questions": {total_questions},
            "estimated_duration": {evaluation_criteria.get('estimated_duration', 10)}
        }}
        """
        
        messages = [
            {"role": "system", "content": f"You are an expert interview designer with deep understanding of technical and behavioral assessment. Create standardized, role-based questions that evaluate job requirements fairly for all candidates. You must respond with valid JSON only containing exactly {total_questions} questions distributed according to the specified criteria."},
            {"role": "user", "content": prompt}
        ]
        
        try:
            response = await self.openai_client.complete(messages, temperature=0.3)
            
            # Log the raw response for debugging
            logger.info(f"Question generation response length: {len(response) if response else 0}")
            if not response:
                logger.error("Empty response from OpenAI for question generation")
                raise ValueError("Empty response from OpenAI")
            
            # Clean the response
            cleaned_response = response.strip()
            if cleaned_response.startswith('```json'):
                cleaned_response = cleaned_response[7:]
            if cleaned_response.endswith('```'):
                cleaned_response = cleaned_response[:-3]
            cleaned_response = cleaned_response.strip()
            
            logger.info(f"Cleaned question generation response preview: {cleaned_response[:200]}...")
            
            try:
                questions_data = json.loads(cleaned_response)
                
                # Validate that we have exactly the specified number of questions
                if 'questions' not in questions_data or len(questions_data['questions']) != total_questions:
                    logger.warning(f"Generated {len(questions_data.get('questions', []))} questions instead of {total_questions}, using standardized fallback")
                    return self._generate_fallback_questions(candidate_type, candidate_level, question_distribution, total_questions, difficulty_level)
                
                # Validate question distribution matches the required criteria
                generated_distribution = {'screening': 0, 'domain': 0, 'behavioral': 0, 'communication': 0}
                for question in questions_data.get('questions', []):
                    category = question.get('category', 'screening')
                    if category in generated_distribution:
                        generated_distribution[category] += 1
                
                # Check if distribution matches required distribution
                distribution_valid = True
                for category, required_count in question_distribution.items():
                    actual_count = generated_distribution.get(category, 0)
                    if actual_count != required_count:
                        logger.warning(f"Distribution mismatch for {category}: required {required_count}, got {actual_count}")
                        distribution_valid = False
                
                if not distribution_valid:
                    logger.warning("Generated questions don't match required distribution, using standardized fallback")
                    return self._generate_fallback_questions(candidate_type, candidate_level, question_distribution, total_questions, difficulty_level)
                
                # Add metadata
                questions_data['total_questions'] = total_questions
                questions_data['estimated_duration'] = evaluation_criteria.get('estimated_duration', 10)
                
                logger.info(f"Successfully generated {total_questions} standardized interview questions with correct distribution")
                logger.info(f"Final distribution: {generated_distribution}")
                return questions_data
                
            except json.JSONDecodeError as e:
                logger.error(f"Question generation JSON decode error: {str(e)}")
                logger.error(f"Attempted to parse: {cleaned_response[:500]}...")
                return self._generate_fallback_questions(candidate_type, candidate_level, question_distribution, total_questions, difficulty_level)
            
        except Exception as e:
            logger.error(f"Error generating interview questions: {str(e)}")
            return self._generate_fallback_questions(candidate_type, candidate_level, question_distribution, total_questions, difficulty_level)
    
    def _generate_fallback_questions(self, candidate_type: str, candidate_level: str, distribution: Dict[str, int], total_questions: int, difficulty_level: str = 'medium') -> Dict[str, Any]:
        """Generate standardized fallback questions if AI generation fails - strictly following distribution"""
        
        # Define difficulty-based question variations
        fallback_questions = {
            'easy': {
            'screening': [
                    "Can you tell me about your background and why you're interested in this role?",
                    "What experience do you have that's relevant to this position?",
                    "What do you know about this role and our company?",
                    "Tell me about your education and training.",
                    "How did you hear about this position?",
                    "What are you looking for in your next role?",
                    "What interests you about this field?"
            ],
            'domain': [
                    f"What {candidate_type} experience do you have?",
                    f"Can you tell me about the {candidate_type} tools you've used?",
                    f"Describe a {candidate_type} project you worked on.",
                    f"What {candidate_type} skills would you like to develop further?",
                    f"How do you approach basic {candidate_type} tasks?",
                    f"What {candidate_type} concepts are you familiar with?",
                    f"Tell me about your {candidate_type} learning journey."
            ],
            'behavioral': [
                    "Tell me about a time you worked well in a team.",
                    "How do you handle feedback?",
                    "Describe a time you learned something new.",
                    "How do you manage your time and priorities?",
                    "Tell me about a challenge you faced and how you overcame it.",
                    "How do you stay motivated at work?",
                    "Describe your ideal work environment."
            ],
            'communication': [
                    "How do you prefer to communicate with colleagues?",
                    "Tell me about a time you had to explain something to someone.",
                    "How do you make sure you understand instructions clearly?",
                    "Describe your communication style.",
                    "How do you handle misunderstandings?",
                    "Tell me about presenting to a group."
                ]
            },
            'medium': {
                'screening': [
                    "Walk me through your professional background and how it led you to this role.",
                    "How does your experience align specifically with this position's requirements?",
                    "What interests you most about this position and our company culture?",
                    "Tell me about your educational background and relevant certifications.",
                    "What career goals do you hope to achieve in this role?",
                    "How do you see this position fitting into your long-term career plan?",
                    "What do you know about our industry and current market trends?"
                ],
                'domain': [
                    f"Describe a challenging {candidate_type} project you've completed successfully.",
                    f"How do you stay current with {candidate_type} trends and best practices?",
                    f"What {candidate_type} methodologies and tools do you prefer and why?",
                    f"Explain how you would approach a complex {candidate_type} problem.",
                    f"What are your strongest {candidate_type} skills and how have you applied them?",
                    f"Describe a time you had to quickly learn a new {candidate_type} technology.",
                    f"How do you ensure quality and efficiency in your {candidate_type} work?"
                ],
                'behavioral': [
                    "Describe a time when you had to work under significant pressure and deliver results.",
                    "Tell me about navigating a challenging team dynamic or conflict.",
                    "How do you approach learning complex new skills or technologies?",
                    "Describe a significant mistake you made and how you handled it.",
                    "Tell me about adapting to a major change in your work environment.",
                    "Describe a situation where you took initiative to solve an important problem.",
                    "How do you balance multiple competing priorities effectively?",
                    "Tell me about a time you had to influence others without formal authority."
                ],
                'communication': [
                    "How do you ensure effective communication across diverse team members?",
                    "Describe presenting complex technical information to non-technical stakeholders.",
                    "How do you handle constructive criticism and incorporate feedback?",
                    "Tell me about facilitating understanding between different departments.",
                    "How do you adapt your communication style to different audiences?",
                    "Describe resolving a significant miscommunication and its consequences."
                ]
            },
            'very_hard': {
                'screening': [
                    "Analyze how your comprehensive background uniquely positions you to drive strategic impact in this role.",
                    "Evaluate the alignment between your experience and our organization's complex challenges and growth objectives.",
                    "What innovative perspectives do you bring that could transform how we approach this role?",
                    "How would you leverage your educational foundation and professional development to create competitive advantages?",
                    "Articulate your vision for how this role could evolve and create value beyond traditional expectations.",
                    "Assess the strategic implications of your career choices and how they prepare you for industry disruption.",
                    "How would you position our organization within the competitive landscape based on your industry insight?"
                ],
                'domain': [
                    f"Design and architect a comprehensive solution for a complex, multi-stakeholder {candidate_type} challenge.",
                    f"How would you establish thought leadership and drive innovation in {candidate_type} within our organization?",
                    f"Evaluate competing {candidate_type} approaches and justify strategic technology decisions for enterprise-scale implementation.",
                    f"How would you build and lead a {candidate_type} transformation initiative with significant business impact?",
                    f"Analyze the future evolution of {candidate_type} and position our organization for emerging opportunities.",
                    f"Design a comprehensive {candidate_type} strategy that balances innovation, risk management, and business objectives.",
                    f"How would you establish and optimize {candidate_type} excellence across multiple teams and complex projects?"
                ],
                'behavioral': [
                    "Analyze a situation where you had to make critical decisions with incomplete information under extreme pressure.",
                    "Describe leading organizational change through significant resistance while maintaining team performance.",
                    "How do you build expertise in emerging fields while managing multiple complex responsibilities?",
                    "Evaluate a major strategic mistake you made and the comprehensive lessons learned.",
                    "Describe architecting solutions for systemic organizational challenges affecting multiple stakeholders.",
                    "How do you drive innovation and calculated risk-taking while ensuring operational excellence?",
                    "Analyze your approach to building high-performing teams across diverse and complex environments.",
                    "Describe influencing C-level executives and board members to support transformational initiatives."
                ],
                'communication': [
                    "How do you architect communication strategies for complex, multi-stakeholder organizational transformations?",
                    "Describe presenting strategic recommendations that influenced major business decisions to executive leadership.",
                    "How do you synthesize and communicate complex analysis to drive consensus among conflicting stakeholder interests?",
                    "Analyze your approach to building communication frameworks that scale across global, diverse organizations.",
                    "How do you establish thought leadership and influence industry conversations through strategic communication?",
                    "Describe managing communication during organizational crisis while maintaining stakeholder confidence and team morale."
                ]
            }
        }
        
        questions = []
        question_id = 1
        
        # Get the appropriate difficulty level questions
        difficulty_questions = fallback_questions.get(difficulty_level, fallback_questions['medium'])
        
        # Only generate questions for categories with allocation > 0
        for category, count in distribution.items():
            if count > 0:  # Only generate questions if count is greater than 0
                category_questions = difficulty_questions.get(category, difficulty_questions['screening'])
                
                for i in range(count):
                    if i < len(category_questions):
                        question_text = category_questions[i]
                    else:
                        # Generate additional questions if we need more than available
                        if difficulty_level == 'easy':
                            question_text = f"Tell me more about your {category} experience and what you've learned."
                        elif difficulty_level == 'very_hard':
                            question_text = f"Analyze and evaluate a complex {category} scenario where you had to drive strategic outcomes."
                        else:
                            question_text = f"Describe a challenging {category} situation and how you approached it systematically."
                    
                    questions.append({
                        "id": question_id,
                        "category": category,
                        "question": question_text,
                        "focus_area": f"{category} assessment ({difficulty_level} level)",
                        "expected_depth": f"{candidate_level} - {difficulty_level} complexity"
                    })
                    question_id += 1
        
        # Build focus description based on actual categories with questions
        focus_areas = []
        if distribution.get('screening', 0) > 0:
            focus_areas.append("background verification")
        if distribution.get('domain', 0) > 0:
            focus_areas.append(f"{candidate_type} expertise")
        if distribution.get('behavioral', 0) > 0:
            focus_areas.append("behavioral assessment")
        if distribution.get('communication', 0) > 0:
            focus_areas.append("communication skills")
        
        interview_focus = f"Focused {difficulty_level.upper()} level assessment on {', '.join(focus_areas)} for {candidate_level} {candidate_type} role"
        
        return {
            "questions": questions,
            "interview_focus": interview_focus,
            "success_criteria": f"Clear communication, relevant experience, and {candidate_level}-appropriate depth in allocated assessment areas",
            "total_questions": len(questions),  # Use actual count of generated questions
            "estimated_duration": len(questions) * 2  # Assuming 2 minutes per question
        }
    
    async def create_interview_prompt(self, questions_data: Dict[str, Any], candidate_name: str, job_role: str) -> str:
        """Create the final interview prompt for the AI interviewer"""
        
        # Check if this is an adaptive interview
        if "question_pool" in questions_data:
            return await self.create_adaptive_interview_prompt(questions_data, candidate_name, job_role)
        
        # Standard interview prompt (backward compatibility)
        questions = questions_data.get('questions', [])
        focus = questions_data.get('interview_focus', 'Comprehensive assessment')
        total_questions = questions_data.get('total_questions', len(questions))
        estimated_duration = questions_data.get('estimated_duration', 10)
        
        questions_list = "\n".join([
            f"{q['id']}. [{q['category'].upper()}] {q['question']}"
            for q in questions
        ])
        
        prompt = f"""You are conducting a professional video interview for a {job_role} position with {candidate_name}.

INTERVIEW STRUCTURE:
You have exactly {total_questions} standardized questions to ask in sequence. Ask ONE question at a time and wait for the candidate's complete response before proceeding to the next question.

YOUR {total_questions} QUESTIONS:
{questions_list}

INTERVIEW GUIDELINES:
1. Start with a warm, professional greeting and brief introduction
2. Ask questions in the exact order listed above
3. Listen carefully to responses and provide brief encouraging feedback
4. Ask natural follow-up questions if responses are too brief or unclear
5. Keep the interview conversational but focused
6. Maintain a professional yet friendly tone throughout
7. After all {total_questions} questions, provide a brief closing and thank the candidate
8. Keep track of time - aim for approximately {estimated_duration} minutes total

INTERVIEW FOCUS: {focus}

SUCCESS CRITERIA: {questions_data.get('success_criteria', 'Clear communication and relevant experience')}

Remember: This is a standardized interview with role-based questions for {candidate_name}. Make them feel comfortable while gathering comprehensive information about their qualifications and fit for the role."""

        return prompt
    
    async def create_adaptive_interview_prompt(self, questions_data: Dict[str, Any], candidate_name: str, job_role: str) -> str:
        """Create an adaptive interview prompt that adjusts difficulty based on candidate responses"""
        
        question_pool = questions_data.get('question_pool', {})
        adaptive_config = questions_data.get('adaptive_config', {})
        interview_flow = questions_data.get('interview_flow', {})
        
        initial_difficulty = adaptive_config.get('initial_difficulty', 'medium')
        total_questions = adaptive_config.get('total_questions', 7)
        questions_per_category = adaptive_config.get('questions_per_category', {})
        adaptation_rules = adaptive_config.get('adaptation_rules', {})
        
        prompt = f"""You are conducting an ADAPTIVE professional video interview for a {job_role} position with {candidate_name}.

ADAPTIVE INTERVIEW FRAMEWORK:
- Initial Difficulty: {initial_difficulty.upper()}
- Total Questions: {total_questions}
- Mode: Adaptive (difficulty adjusts based on candidate performance)

QUESTION DISTRIBUTION:
{json.dumps(questions_per_category, indent=2)}

QUESTION POOL STRUCTURE:
{json.dumps({cat: {diff: len(qs) for diff, qs in diffs.items()} for cat, diffs in question_pool.items()}, indent=2)}

ADAPTIVE RULES:

1. DIFFICULTY ADJUSTMENT:
   
   DOWNGRADE (Hard→Medium→Easy) when:
   - Candidate uses struggle indicators: {', '.join(adaptation_rules['struggle_indicators'])}
   - Answers are vague, incorrect, or show confusion
   - Multiple clarifications needed
   - Long unproductive pauses
   
   UPGRADE (Easy→Medium→Hard) when:
   - Candidate uses excellence indicators: {', '.join(adaptation_rules['excellence_indicators'])}
   - Provides comprehensive answers with examples
   - Shows deep understanding
   - Demonstrates confidence and expertise
   
   MAINTAIN level when:
   - Adequate but not exceptional answers
   - Basic understanding without depth
   - Some guidance needed but reasonable responses

2. QUESTION SELECTION:
   - Start each category at {initial_difficulty} level
   - Select appropriate difficulty based on previous answer
   - Use questions from: {json.dumps(question_pool, indent=2)}
   - Track which questions you've asked

3. INTERVIEW FLOW:
   - Ask ONE question at a time
   - Evaluate response quality
   - Note difficulty adjustment: "[Moving to EASY/MEDIUM/HARD level]"
   - Natural transitions: "Let me ask you something [more fundamental/more advanced]..."
   - Complete exactly {total_questions} questions

4. TRACKING:
   After each answer, internally note:
   - Response quality (poor/adequate/good/excellent)
   - Difficulty decision (maintain/upgrade/downgrade)
   - Reason for adjustment

Remember: Find the candidate's optimal challenge level through adaptive questioning. Make them comfortable while accurately assessing their capabilities."""

        return prompt

# Resume Analyzer with Classification
class ResumeAnalyzer:
    """Analyze and classify resumes against job descriptions"""
    
    def __init__(self, openai_client: AzureOpenAIClient):
        self.openai_client = openai_client
    
    def _repair_json(self, json_str: str) -> str:
        """Attempt to repair common JSON issues"""
        try:
            logger.info(f"Starting JSON repair for {len(json_str)} character response")
            
            # Start with the original string
            repaired = json_str.strip()
            
            # Remove any markdown formatting that might have been missed
            if repaired.startswith('```'):
                lines = repaired.split('\n')
                # Find first line that starts with {
                start_idx = 0
                for i, line in enumerate(lines):
                    if line.strip().startswith('{'):
                        start_idx = i
                        break
                # Find last line that ends with }
                end_idx = len(lines) - 1
                for i in range(len(lines) - 1, -1, -1):
                    if lines[i].strip().endswith('}'):
                        end_idx = i
                        break
                repaired = '\n'.join(lines[start_idx:end_idx + 1])
            
            # Fix common JSON issues step by step
            
            # 1. Remove trailing commas before closing braces/brackets
            repaired = re.sub(r',(\s*[}\]])', r'\1', repaired)
            
            # 2. Fix unescaped quotes in strings (basic approach)
            # Look for patterns like "text with "quotes" inside"
            repaired = re.sub(r'"([^"]*)"([^"]*)"([^"]*)"', r'"\1\\"2\\"\3"', repaired)
            
            # 3. Handle incomplete strings at the end
            # If there's an unmatched quote at the end, close it
            quote_count = repaired.count('"')
            if quote_count % 2 != 0:
                # Find the last quote and see if it needs closing
                last_quote_idx = repaired.rfind('"')
                if last_quote_idx > 0:
                    # Look for the pattern: "key": "incomplete_value
                    after_quote = repaired[last_quote_idx + 1:]
                    if not after_quote.strip().endswith('"') and not after_quote.strip().endswith('"}'):
                        # Add closing quote
                        repaired = repaired[:last_quote_idx + 1] + after_quote.split('\n')[0].strip() + '"'
                        # Remove any text after that
                        lines = repaired.split('\n')
                        repaired = lines[0] if len(lines) > 1 else repaired
            
            # 4. Ensure proper structure completion
            # Count opening and closing braces/brackets
            open_braces = repaired.count('{')
            close_braces = repaired.count('}')
            open_brackets = repaired.count('[')
            close_brackets = repaired.count(']')
            
            # Add missing closing braces and brackets
            while close_braces < open_braces:
                repaired += '}'
                close_braces += 1
            while close_brackets < open_brackets:
                repaired += ']'
                close_brackets += 1
            
            # 5. Remove any trailing text after the last complete JSON object
            # Find the last properly closed brace
            brace_count = 0
            last_valid_pos = -1
            for i, char in enumerate(repaired):
                if char == '{':
                    brace_count += 1
                elif char == '}':
                    brace_count -= 1
                    if brace_count == 0:
                        last_valid_pos = i
            
            if last_valid_pos > 0 and last_valid_pos < len(repaired) - 1:
                repaired = repaired[:last_valid_pos + 1]
            
            # 6. Handle missing commas between key-value pairs
            # Look for patterns like: "key1": "value1" "key2": "value2"
            repaired = re.sub(r'"\s*"\s*([a-zA-Z_][a-zA-Z0-9_]*)":', r'", "\1":', repaired)
            
            # 7. Fix missing commas after array/object elements
            # Pattern: } "key": becomes }, "key":
            repaired = re.sub(r'}\s*"([^"]+)":', r'}, "\1":', repaired)
            # Pattern: ] "key": becomes ], "key":
            repaired = re.sub(r']\s*"([^"]+)":', r'], "\1":', repaired)
            
            logger.info(f"JSON repair completed. Original: {len(json_str)}, Repaired: {len(repaired)}")
            logger.debug(f"Repaired JSON preview: {repaired[:300]}...")
            
            return repaired
            
        except Exception as e:
            logger.error(f"Error during JSON repair: {str(e)}")
            logger.error(f"Full repair error: {traceback.format_exc()}")
            return json_str  # Return original if repair fails
    
    async def classify_resume(self, resume_text: str) -> ResumeClassification:
        """Classify resume into category and level"""
        
        prompt = f"""
        Classify the following resume into appropriate categories:
        
        RESUME:
        {resume_text}
        
        Provide classification in JSON format:
        {{
            "category": "tech/non-tech/semi-tech",
            "level": "entry/mid/senior",
            "confidence": 0.0-1.0,
            "reasoning": {{
                "category_reasoning": "explanation for category classification",
                "level_reasoning": "explanation for level classification",
                "key_indicators": ["list of key indicators used for classification"]
            }}
        }}
        
        Category definitions:
        - tech: Primarily technical roles (developers, engineers, data scientists, etc.)
        - non-tech: Non-technical roles (HR, sales, marketing, operations, etc.)
        - semi-tech: Mixed technical and non-technical (technical PM, business analyst, etc.)
        
        Level definitions:
        - entry: 0-2 years experience or fresh graduate
        - mid: 3-7 years experience
        - senior: 8+ years experience or leadership roles
        
        Consider education, years of experience, job titles, skills, and responsibilities.
        """
        
        messages = [
            {"role": "system", "content": "You are an expert resume classifier with deep understanding of various industries and roles. IMPORTANT: You must respond with valid, well-formatted JSON only. Do not include any text before or after the JSON."},
            {"role": "user", "content": prompt}
        ]
        
        try:
            response = await self.openai_client.complete(messages, temperature=0.1)
            
            # Log the raw response for debugging  
            logger.info(f"Classification response length: {len(response) if response else 0}")
            if not response:
                logger.error("Empty classification response from OpenAI")
                raise ValueError("Empty classification response from OpenAI")
            
            # Clean the response - remove any markdown formatting
            cleaned_response = response.strip()
            if cleaned_response.startswith('```json'):
                cleaned_response = cleaned_response[7:]  # Remove ```json
            if cleaned_response.endswith('```'):
                cleaned_response = cleaned_response[:-3]  # Remove ```
            cleaned_response = cleaned_response.strip()
            
            logger.info(f"Cleaned classification response preview: {cleaned_response[:200]}...")
            
            try:
                classification_data = json.loads(cleaned_response)
                logger.info("Successfully parsed classification JSON")
            except json.JSONDecodeError as e:
                logger.error(f"Classification JSON decode error: {str(e)}")
                logger.error(f"Attempted to parse: {cleaned_response[:500]}...")
                
                # Fallback classification
                classification_data = {
                    "category": "tech",
                    "level": "mid", 
                    "confidence": 0.5
                }
                logger.warning("Using fallback classification due to JSON parsing error")
            
            # Track classification metrics
            classification_counter.labels(
                category=classification_data["category"],
                level=classification_data["level"]
            ).inc()
            
            return ResumeClassification(
                category=classification_data["category"],
                level=classification_data["level"],
                confidence=classification_data["confidence"]
            )
        except Exception as e:
            logger.error(f"Resume classification error: {str(e)}")
            logger.error(f"Full error details: {traceback.format_exc()}")
            # Default classification on error
            return ResumeClassification(
                category="tech",
                level="mid",
                confidence=0.5
            )
    
    async def analyze_resume(self, resume_text: str, job_analysis: Dict[str, Any], 
                           job_description: str, classification: ResumeClassification) -> Dict[str, Any]:
        """Analyze resume fit for job with classification context"""
        
        prompt = f"""
        Analyze the following resume against the job requirements:
        
        RESUME CLASSIFICATION:
        - Category: {classification.category}
        - Level: {classification.level}
        
        JOB REQUIREMENTS:
        {json.dumps(job_analysis, indent=2)}
        
        ORIGINAL JOB DESCRIPTION:
        {job_description}
        
        RESUME:
        {resume_text}
        
        Provide analysis in this EXACT JSON format (no additional text, no markdown):
        {{
            "fit_score": 0-100,
            "matching_skills": ["skill1", "skill2", "skill3"],
            "missing_skills": ["missing1", "missing2"],
            "experience_score": 0-100,
            "recommendation": "STRONG_FIT or GOOD_FIT or MODERATE_FIT or WEAK_FIT",
            "detailed_feedback": "Single paragraph comprehensive feedback"
        }}
        
        Keep it simple and ensure valid JSON syntax.
        """
        
        messages = [
            {"role": "system", "content": "You are an expert technical recruiter with deep understanding of skill assessment, resume analysis, and role-level matching. IMPORTANT: You must respond with valid, well-formatted JSON only. Do not include any text before or after the JSON. Ensure all strings are properly quoted and escaped, and all nested structures are complete."},
            {"role": "user", "content": prompt}
        ]
        
        try:
            response = await self.openai_client.complete(messages, temperature=0.2)
            
            # Log the raw response for debugging
            logger.info(f"Analysis response length: {len(response) if response else 0}")
            if not response:
                logger.error("Empty analysis response from OpenAI")
                raise ValueError("Empty analysis response from OpenAI")
            
            # Clean the response - remove any markdown formatting
            cleaned_response = response.strip()
            if cleaned_response.startswith('```json'):
                cleaned_response = cleaned_response[7:]  # Remove ```json
            if cleaned_response.endswith('```'):
                cleaned_response = cleaned_response[:-3]  # Remove ```
            cleaned_response = cleaned_response.strip()
            
            logger.info(f"Cleaned analysis response preview: {cleaned_response[:200]}...")
            
            try:
                analysis = json.loads(cleaned_response)
                logger.info("Successfully parsed analysis JSON")
                return analysis
            except json.JSONDecodeError as e:
                logger.error(f"Analysis JSON decode error: {str(e)}")
                logger.error(f"Attempted to parse: {cleaned_response[:500]}...")
                
                # Try to repair common JSON issues
                try:
                    logger.info("Attempting JSON repair...")
                    repaired_json = self._repair_json(cleaned_response)
                    analysis = json.loads(repaired_json)
                    logger.info("Successfully parsed repaired JSON")
                    return analysis
                except Exception as repair_error:
                    logger.error(f"JSON repair failed: {str(repair_error)}")
                
                # Create fallback analysis
                fallback_analysis = {
                    "fit_score": 50.0,
                    "matching_skills": ["Analysis failed"],
                    "missing_skills": ["Manual review required"],
                    "experience_score": 50,
                    "recommendation": "MANUAL_REVIEW",
                    "detailed_feedback": "Automatic analysis failed due to parsing error. Manual review recommended."
                }
                logger.warning("Using fallback analysis due to JSON parsing error")
                return fallback_analysis
                
        except json.JSONDecodeError:
            logger.error("Failed to parse resume analysis response")
            raise
        except Exception as e:
            logger.error(f"Resume analysis error: {str(e)}")
            logger.error(f"Full error details: {traceback.format_exc()}")
            raise

# Batch Processor
class BatchProcessor:
    """Handle batch processing of resumes"""
    
    def __init__(self):
        self.openai_client = AzureOpenAIClient()
        self.resume_analyzer = ResumeAnalyzer(self.openai_client)
        self.name_extractor = CandidateNameExtractor(self.openai_client)
        self.executor = ThreadPoolExecutor(max_workers=Config.MAX_CONCURRENT_REQUESTS)
    
    async def process_batch(self, job_id: str, resumes: List[Tuple[str, str, str]], 
                          job_analysis: Dict[str, Any], job_description: str) -> List[ResumeAnalysisResult]:
        """Process a batch of resumes"""
        
        results = []
        tasks = []
        
        for resume_id, filename, resume_text in resumes:
            task = self.process_single_resume(
                resume_id, filename, resume_text, job_id, job_analysis, job_description
            )
            tasks.append(task)
        
        # Process in parallel with limited concurrency
        completed = await asyncio.gather(*tasks, return_exceptions=True)
        
        for i, result in enumerate(completed):
            if isinstance(result, Exception):
                logger.error(f"Batch processing error for task {i}: {str(result)}")
                logger.error(f"Full error: {traceback.format_exc()}")
            else:
                results.append(result)
                logger.debug(f"Successfully processed task {i}: {result.filename if hasattr(result, 'filename') else 'unknown'}")
        
        logger.info(f"Batch completed: {len(results)} successful, {len([r for r in completed if isinstance(r, Exception)])} failed")
        return results
    
    async def process_single_resume(self, resume_id: str, filename: str, resume_text: str, 
                                  job_id: str, job_analysis: Dict[str, Any], 
                                  job_description: str) -> ResumeAnalysisResult:
        """Process a single resume with classification and intelligent name extraction"""
        
        with processing_time_histogram.time():
            try:
                # Extract candidate name using LLM (parallel processing)
                logger.info(f"🔍 Extracting candidate name from resume: {filename}")
                extracted_name = await self.name_extractor.extract_candidate_name(resume_text, filename)
                logger.info(f"✅ Extracted candidate name: '{extracted_name}' for file: {filename}")
                
                # First, classify the resume
                classification = await self.resume_analyzer.classify_resume(resume_text)
                
                # Then analyze it against the job
                analysis = await self.resume_analyzer.analyze_resume(
                    resume_text, job_analysis, job_description, classification
                )
                
                # Extract results
                result = ResumeAnalysisResult(
                    resume_id=resume_id,
                    filename=filename,
                    classification=classification,
                    fit_score=analysis['fit_score'],
                    matching_skills=analysis['matching_skills'] if isinstance(analysis['matching_skills'], list) else self._flatten_skills(analysis['matching_skills']),
                    missing_skills=analysis['missing_skills'] if isinstance(analysis['missing_skills'], list) else self._flatten_skills(analysis['missing_skills']),
                    recommendation=analysis['recommendation'],
                    detailed_analysis=analysis
                )
                
                # Prepare enhanced data for storage with extracted name
                result_data = result.dict()
                result_data["extracted_candidate_name"] = extracted_name  # Add the LLM-extracted name
                
                # Store result with enhanced data
                storage.add_resume_analysis(job_id, result_data)
                
                resume_processed_counter.inc()
                logger.info(f"Processed resume for '{extracted_name}': {classification.category}/{classification.level} - Score: {analysis['fit_score']}")
                
                return result
                
            except Exception as e:
                logger.error(f"Error processing resume {resume_id} ({filename}): {str(e)}")
                logger.error(f"Full error: {traceback.format_exc()}")
                
                # Try to extract name even in fallback case
                try:
                    extracted_name = await self.name_extractor.extract_candidate_name(resume_text, filename)
                except:
                    extracted_name = self.name_extractor._extract_name_from_filename(filename)
                
                # Create a fallback result instead of failing completely
                fallback_classification = ResumeClassification(
                    category="tech",
                    level="mid", 
                    confidence=0.5
                )
                
                fallback_result = ResumeAnalysisResult(
                    resume_id=resume_id,
                    filename=filename,
                    classification=fallback_classification,
                    fit_score=50.0,
                    matching_skills=["Analysis failed - manual review required"],
                    missing_skills=["Could not analyze due to processing error"],
                    recommendation="MANUAL_REVIEW",
                    detailed_analysis={
                        "error": str(e),
                        "status": "processing_failed",
                        "note": "This resume could not be automatically analyzed. Manual review recommended."
                    }
                )
                
                # Prepare fallback data with extracted name
                fallback_data = fallback_result.dict()
                fallback_data["extracted_candidate_name"] = extracted_name
                
                # Store fallback result using .dict() for Pydantic models
                storage.add_resume_analysis(job_id, fallback_data)
                
                resume_processed_counter.inc()
                logger.warning(f"Created fallback result for '{extracted_name}' due to processing error")
                
                return fallback_result
    
    def _flatten_skills(self, skills_dict: Dict[str, List[str]]) -> List[str]:
        """Flatten nested skills dictionary"""
        flattened = []
        try:
            if isinstance(skills_dict, dict):
                for category, skills in skills_dict.items():
                    if isinstance(skills, list):
                        flattened.extend(skills)
                    elif isinstance(skills, str):
                        flattened.append(skills)
                    else:
                        logger.warning(f"Unexpected skill format in category {category}: {type(skills)}")
            elif isinstance(skills_dict, list):
                # If it's already a list, return as-is
                flattened = skills_dict
            else:
                logger.warning(f"Unexpected skills format: {type(skills_dict)}")
                flattened = ["Analysis format error"]
        except Exception as e:
            logger.error(f"Error flattening skills: {str(e)}")
            flattened = ["Error extracting skills"]
        
        return flattened

# Background task processor
async def process_resumes_background(job_id: str, file_contents: List[Dict]):
    """Background task to process resumes"""
    
    active_jobs_gauge.inc()
    
    try:
        job_data = storage.get_job(job_id)
        if not job_data or not job_data.get("analysis"):
            logger.error(f"Job {job_id} not found or not analyzed")
            return
        
        parser = ResumeParser()
        processor = BatchProcessor()
        
        # Parse resumes with better error handling
        resumes_data = []
        successfully_parsed = 0
        failed_files = []
        
        for file_data in file_contents:
            filename = file_data["filename"]
            content = file_data["content"]
            
            try:
                logger.info(f"Processing file: {filename} ({len(content)} bytes)")
                resume_text = parser.extract_text(content, filename)
                
                # Validate that we got some text
                if not resume_text or len(resume_text.strip()) < 10:
                    logger.warning(f"File {filename} produced very little text: {len(resume_text)} characters")
                    failed_files.append(f"{filename} (insufficient content)")
                    continue
                
                resume_id = str(uuid.uuid4())
                resumes_data.append((resume_id, filename, resume_text))
                successfully_parsed += 1
                logger.info(f"Successfully parsed {filename}: {len(resume_text)} characters extracted")
                
            except Exception as e:
                logger.error(f"Error parsing file {filename}: {str(e)}")
                logger.error(f"Full error: {traceback.format_exc()}")
                failed_files.append(f"{filename} ({str(e)})")
        
        # Update total count with successfully parsed resumes
        storage.increment_total_resumes(job_id, len(resumes_data))
        
        if not resumes_data:
            logger.error(f"No resumes could be parsed for job {job_id}")
            return
        
        logger.info(f"Successfully parsed {successfully_parsed} out of {len(file_contents)} files for job {job_id}")
        if failed_files:
            logger.warning(f"Failed to parse files: {failed_files}")
        
        # Process in batches
        for i in range(0, len(resumes_data), Config.BATCH_SIZE):
            batch = resumes_data[i:i + Config.BATCH_SIZE]
            try:
                await processor.process_batch(
                    job_id, batch, job_data["analysis"], job_data["description"]
                )
                logger.info(f"Processed batch {i//Config.BATCH_SIZE + 1} for job {job_id}")
            except Exception as e:
                logger.error(f"Error processing batch {i//Config.BATCH_SIZE + 1}: {str(e)}")
            
    except Exception as e:
        logger.error(f"Background processing error for job {job_id}: {str(e)}")
        logger.error(f"Full error: {traceback.format_exc()}")
    finally:
        active_jobs_gauge.dec()

# FastAPI Application
app = FastAPI(title="Resume Screening System with Classification", version="2.0.0")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:8080", "http://localhost:5173"],  # React development servers
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Startup event handler
@app.on_event("startup")
async def startup_event():
    """Initialize data on startup"""
    logger.info("🚀 Application startup - initializing...")
    
    # Check Supabase connection
    if storage.supabase_store.supabase:
        try:
            # Just verify connection, don't auto-populate data
            test_result = storage.supabase_store.supabase.table("job_posts").select("count").limit(1).execute()
            logger.info("✅ Supabase connection verified")
            logger.info("💡 Interview setup data will be configured from the frontend")
        except Exception as e:
            logger.error(f"❌ Error during startup: {str(e)}")
    else:
        logger.warning("⚠️ Supabase not available")

@app.post("/api/jobs", response_model=Dict[str, str])
async def create_job(job_input: JobDescriptionInput, background_tasks: BackgroundTasks):
    """Create a new job posting and analyze it"""
    
    try:
        job_id = str(uuid.uuid4())
        
        # Store job and wait for successful database storage
        job_created = await storage.create_job(job_id, {
            "job_role": job_input.job_role,
            "required_experience": job_input.required_experience,
            "description": job_input.description
        })
        
        if not job_created:
            logger.error(f"Failed to store job {job_id} in database")
            raise HTTPException(status_code=500, detail="Failed to create job in database")
        
        # Analyze job in background only after successful creation
        background_tasks.add_task(analyze_job_background, job_id)
        
        logger.info(f"✅ Job {job_id} created successfully and analysis started")
        return {"job_id": job_id, "status": "Job created and analysis started"}
        
    except HTTPException:
        raise  # Re-raise HTTP exceptions as-is
    except Exception as e:
        logger.error(f"Error creating job: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to create job")

@app.get("/api/jobs/{job_id}")
async def get_job(job_id: str):
    """Get a specific job by ID"""
    try:
        if not storage.supabase_store.supabase:
            raise HTTPException(status_code=503, detail="Database not available")
        
        result = storage.supabase_store.supabase.table("job_posts").select("*").eq("id", job_id).single().execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="Job not found")
        
        # Transform response to match frontend expectations
        job_data = result.data
        
        # Flatten response and rename fields for frontend compatibility
        response = {
            "id": job_data.get("id"),
            "job_role": job_data.get("job_role"),
            "required_experience": job_data.get("required_experience"),
            "description": job_data.get("job_description"),
            "created_at": job_data.get("created_at"),
            "analysis": job_data.get("job_description_analysis"),  # Rename for frontend
            "status": "Active" if job_data.get("job_description_analysis") else "Processing"
        }
        
        logger.info(f"📋 Returning job {job_id} - Analysis: {'✅ Complete' if response['analysis'] else '⏳ Processing'}")
        return response
        
    except HTTPException:
        raise  # Re-raise HTTP exceptions as-is
    except Exception as e:
        logger.error(f"Error fetching job {job_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch job")

@app.get("/api/jobs")
async def get_all_jobs():
    """Get all jobs from the database"""
    logger.info("GET /api/jobs endpoint called")
    try:
        if not storage.supabase_store.supabase:
            logger.info("Using in-memory storage for jobs")
            # Return in-memory jobs if Supabase not available
            jobs = []
            for job_id, job_data in storage.memory_store.jobs.items():
                jobs.append({
                    "id": job_id,
                    "job_role": job_data["job_role"],
                    "required_experience": job_data["required_experience"],
                    "description": job_data["description"],
                    "created_at": job_data["created_at"],
                    "analysis": job_data["analysis"]
                })
            logger.info(f"Returning {len(jobs)} jobs from in-memory storage")
            return {"status": "success", "data": jobs}
        
        logger.info("Using Supabase storage for jobs")
        # Get from Supabase - fix the order syntax
        result = storage.supabase_store.supabase.table("job_posts").select("*").order("created_at", desc=True).execute()
        
        if result.data:
            logger.info(f"Retrieved {len(result.data)} jobs from Supabase")
            # Format the data to match frontend expectations
            jobs = []
            for job in result.data:
                jobs.append({
                    "id": job["id"],
                    "job_role": job["job_role"],
                    "required_experience": job["required_experience"],
                    "description": job["job_description"],
                    "created_at": job["created_at"],
                    "analysis": job["job_description_analysis"]
                })
            
            return {"status": "success", "data": jobs}
        else:
            logger.info("No jobs found in Supabase")
            return {"status": "success", "data": []}
            
    except Exception as e:
        logger.error(f"Error fetching all jobs: {str(e)}")
        return {"status": "error", "error": str(e)}

async def analyze_job_background(job_id: str):
    """Background task to analyze job description"""
    
    try:
        job_data = storage.get_job(job_id)
        if not job_data:
            return
        
        openai_client = AzureOpenAIClient()
        job_analyzer = JobAnalyzer(openai_client)
        
        analysis = await job_analyzer.analyze_job_description(
            job_data["job_role"], 
            job_data["required_experience"], 
            job_data["description"]
        )
        
        storage.update_job_analysis(job_id, analysis)
        logger.info(f"Job {job_id} analyzed successfully")
            
    except Exception as e:
        logger.error(f"Error analyzing job {job_id}: {str(e)}")

@app.post("/api/jobs/{job_id}/resumes")
async def upload_resumes(
    job_id: str,
    files: List[UploadFile] = File(...),
    background_tasks: BackgroundTasks = None
):
    """Upload resumes for a job"""
    
    # Verify job exists and is analyzed
    job_data = storage.get_job(job_id)
    if not job_data:
        raise HTTPException(status_code=404, detail="Job not found")
    
    if not job_data.get("analysis"):
        raise HTTPException(status_code=400, detail="Job analysis not complete. Please wait and try again.")
    
    # Read file contents immediately before they get closed
    file_contents = []
    successfully_read = 0
    
    for file in files:
        try:
            content = await file.read()
            if content:
                file_contents.append({
                    "filename": file.filename,
                    "content": content,
                    "content_type": file.content_type
                })
                successfully_read += 1
                logger.info(f"Successfully read file {file.filename}: {len(content)} bytes")
            else:
                logger.warning(f"File {file.filename} is empty")
        except Exception as e:
            logger.error(f"Error reading file {file.filename}: {str(e)}")
    
    if not file_contents:
        raise HTTPException(status_code=400, detail="No valid files could be read")
    
    # Process resumes in background with file contents
    background_tasks.add_task(process_resumes_background, job_id, file_contents)
    
    return {
        "job_id": job_id,
        "resumes_uploaded": len(file_contents),
        "files_read": successfully_read,
        "total_files": len(files),
        "status": "Processing started"
    }

@app.get("/api/jobs/{job_id}/results")
async def get_job_results(
    job_id: str,
    min_score: Optional[float] = None,
    category: Optional[str] = None,
    level: Optional[str] = None,
    limit: Optional[int] = 100,
    offset: Optional[int] = 0
):
    """Get analysis results for a job with filtering options"""
    
    # Verify job exists
    if not storage.get_job(job_id):
        raise HTTPException(status_code=404, detail="Job not found")
    
    # Try to get results from Supabase first (includes candidate names)
    if storage.supabase_store.supabase:
        try:
            # Get from Supabase with proper candidate names
            query = storage.supabase_store.supabase.table("resume_results").select("*").eq("job_post_id", job_id)
            
            # Apply filters
            if min_score:
                query = query.gte("fit_score", min_score)
            if category:
                query = query.eq("candidate_type", category)
            if level:
                query = query.eq("candidate_level", level)
            
            # Order by fit score descending
            query = query.order("fit_score", desc=True)
            
            # Get results
            result = query.execute()
            
            if result.data:
                # Transform Supabase data to match expected format
                transformed_results = []
                for row in result.data:
                    transformed_result = {
                        "resume_id": row["id"],
                        "filename": row["resume_file_name"],
                        "candidate_name": row["candidate_name"],  # Include extracted candidate name
                        "classification": {
                            "category": row["candidate_type"],
                            "level": row["candidate_level"],
                            "confidence": 0.9  # Default confidence
                        },
                        "fit_score": row["fit_score"],
                        "matching_skills": row["matching_skills"] or [],
                        "missing_skills": row["missing_skills"] or [],
                        "recommendation": row["recommendation"],
                        "detailed_analysis": row["resume_analysis_data"] or {},
                        "created_at": row["created_at"]
                    }
                    transformed_results.append(transformed_result)
                
                # Apply pagination
                total = len(transformed_results)
                paginated_results = transformed_results[offset:offset + limit]
                
                # Get classification summary
                classification_summary = defaultdict(lambda: defaultdict(int))
                for r in transformed_results:
                    cat = r.get("classification", {}).get("category", "unknown")
                    lvl = r.get("classification", {}).get("level", "unknown")
                    classification_summary[cat][lvl] += 1
                
                logger.info(f"✅ Retrieved {len(transformed_results)} results from Supabase for job {job_id}")
                
                return {
                    "job_id": job_id,
                    "total_results": total,
                    "offset": offset,
                    "limit": limit,
                    "classification_summary": dict(classification_summary),
                    "results": paginated_results
                }
                
        except Exception as e:
            logger.error(f"Error fetching results from Supabase for job {job_id}: {str(e)}")
            # Fall back to memory storage
    
    # Fallback to memory storage (for backward compatibility)
    logger.warning(f"⚠️ Falling back to memory storage for job {job_id} - Data may be inconsistent!")
    logger.warning("⚠️ Memory candidates may not exist in database - interview links may fail!")
    results = storage.get_results(job_id, min_score)
    
    # Validate that memory candidates exist in database to prevent interview link failures
    if results and storage.supabase_store.supabase:
        logger.info(f"🔍 Validating {len(results)} memory candidates against database...")
        valid_results = []
        for result in results:
            candidate_id = result.get("id") or result.get("resume_id")
            if candidate_id:
                try:
                    # Check if candidate exists in database
                    db_check = storage.supabase_store.supabase.table("resume_results").select("id").eq("id", candidate_id).execute()
                    if db_check.data:
                        valid_results.append(result)
                        logger.debug(f"✅ Candidate {candidate_id} exists in database")
                    else:
                        logger.warning(f"❌ Candidate {candidate_id} in memory but NOT in database - excluding from results")
                except Exception as e:
                    logger.error(f"❌ Error checking candidate {candidate_id}: {str(e)}")
                    # Exclude this candidate to prevent errors
        
        if len(valid_results) != len(results):
            logger.warning(f"⚠️ Filtered out {len(results) - len(valid_results)} invalid candidates from memory")
        results = valid_results
    
    # Apply filters
    if category:
        results = [r for r in results if r.get("classification", {}).get("category") == category]
    if level:
        results = [r for r in results if r.get("classification", {}).get("level") == level]
    
    # Apply pagination
    total = len(results)
    results = results[offset:offset + limit]
    
    # Get classification summary
    classification_summary = defaultdict(lambda: defaultdict(int))
    all_results = storage.get_results(job_id)
    for r in all_results:
        cat = r.get("classification", {}).get("category", "unknown")
        lvl = r.get("classification", {}).get("level", "unknown")
        classification_summary[cat][lvl] += 1
    
    # Add a warning flag if using memory storage
    response = {
        "job_id": job_id,
        "total_results": total,
        "offset": offset,
        "limit": limit,
        "classification_summary": dict(classification_summary),
        "results": results
    }
    
    # If we're here, we used memory storage - add warning
    if results:
        response["data_source"] = "memory"
        response["warning"] = "Data loaded from memory cache. Some features may not work properly."
        logger.warning(f"⚠️ Returning {len(results)} candidates from memory for job {job_id}")
    
    return response

@app.get("/api/jobs/{job_id}/status")
async def get_job_status(job_id: str):
    """Get processing status for a job"""
    
    # Verify job exists
    if not storage.get_job(job_id):
        raise HTTPException(status_code=404, detail="Job not found")
    
    status = storage.get_status(job_id)
    
    return {
        "job_id": job_id,
        "total_resumes": status["total"],
        "processed_resumes": status["processed"],
        "pending_resumes": status["total"] - status["processed"],
        "completion_percentage": (status["processed"] / status["total"] * 100) if status["total"] > 0 else 0
    }

@app.get("/api/jobs/{job_id}")
async def get_job_details(job_id: str):
    """Get job details including analysis"""
    
    job_data = storage.get_job(job_id)
    if not job_data:
        raise HTTPException(status_code=404, detail="Job not found")
    
    return job_data

@app.delete("/api/jobs/{job_id}")
async def delete_job(job_id: str):
    """Delete a job and all its associated data"""
    try:
        if not storage.supabase_store.supabase:
            raise HTTPException(status_code=500, detail="Database not available")
        
        # Check if job exists in Supabase directly
        existing_job = storage.supabase_store.supabase.table("job_posts").select("id").eq("id", job_id).execute()
        
        if not existing_job.data:
            raise HTTPException(status_code=404, detail="Job not found")
        
        logger.info(f"Deleting job {job_id} from database...")
        
        # Delete from Supabase (will cascade delete related data)
        result = storage.supabase_store.supabase.table("job_posts").delete().eq("id", job_id).execute()
        
        if result.data:
            # Also delete from local storage if exists
            if hasattr(storage, 'memory_store') and job_id in storage.memory_store.jobs:
                del storage.memory_store.jobs[job_id]
            
            logger.info(f"Successfully deleted job {job_id}")
            return {
                "status": "success",
                "message": f"Job {job_id} deleted successfully",
                "job_id": job_id
            }
        else:
            logger.error(f"Failed to delete job {job_id} - no data returned from delete operation")
            raise HTTPException(status_code=500, detail="Failed to delete job from database")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting job {job_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete job: {str(e)}")

@app.post("/api/test-file-upload")
async def test_file_upload(files: List[UploadFile] = File(...)):
    """Test endpoint to verify file upload and processing"""
    try:
        results = []
        parser = ResumeParser()
        
        for file in files:
            try:
                content = await file.read()
                if content:
                    text = parser.extract_text(content, file.filename)
                    results.append({
                        "filename": file.filename,
                        "size": len(content),
                        "text_length": len(text),
                        "text_preview": text[:200] if text else "No text extracted",
                        "status": "success"
                    })
                else:
                    results.append({
                        "filename": file.filename,
                        "status": "error",
                        "error": "Empty file"
                    })
            except Exception as e:
                results.append({
                    "filename": file.filename,
                    "status": "error", 
                    "error": str(e)
                })
        
        return {
            "status": "success",
            "files_processed": len(results),
            "results": results
        }
        
    except Exception as e:
        return {
            "status": "error",
            "error": str(e)
        }

@app.get("/api/test-openai")
async def test_openai_connection():
    """Test endpoint to verify OpenAI connection"""
    try:
        openai_client = AzureOpenAIClient()
        test_messages = [
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": "Respond with a simple JSON object: {\"status\": \"ok\", \"message\": \"Connection successful\"}"}
        ]
        
        response = await openai_client.complete(test_messages)
        
        return {
            "status": "success",
            "response_length": len(response) if response else 0,
            "response_preview": response[:200] if response else "Empty response",
            "config": {
                "endpoint": Config.AZURE_OPENAI_ENDPOINT,
                "deployment": Config.AZURE_OPENAI_DEPLOYMENT,
                "api_version": Config.AZURE_OPENAI_API_VERSION
            }
        }
        
    except Exception as e:
        logger.error(f"OpenAI test failed: {str(e)}")
        return {
            "status": "error",
            "error": str(e),
            "config": {
                "endpoint": Config.AZURE_OPENAI_ENDPOINT,
                "deployment": Config.AZURE_OPENAI_DEPLOYMENT,
                "api_version": Config.AZURE_OPENAI_API_VERSION
            }
        }

@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "active_jobs": active_jobs_gauge._value.get()
    }

@app.get("/metrics")
async def metrics():
    """Prometheus metrics endpoint"""
    return Response(generate_latest(), media_type="text/plain")

@app.get("/api/test-json-repair")
async def test_json_repair():
    """Test endpoint to verify JSON repair functionality"""
    try:
        analyzer = ResumeAnalyzer(AzureOpenAIClient())
        
        # Test cases for JSON repair
        test_cases = [
            # Missing closing brace
            '{"test": "value", "array": [1, 2, 3]',
            # Trailing comma
            '{"test": "value", "array": [1, 2, 3,]}',
            # Multiple issues
            '{"test": "value", "array": [1, 2, 3,], "incomplete": "data"',
        ]
        
        results = []
        for i, broken_json in enumerate(test_cases):
            try:
                repaired = analyzer._repair_json(broken_json)
                # Try to parse the repaired JSON
                parsed = json.loads(repaired)
                results.append({
                    f"test_{i+1}": {
                        "original": broken_json,
                        "repaired": repaired,
                        "parsed_successfully": True,
                        "parsed_data": parsed
                    }
                })
            except Exception as e:
                results.append({
                    f"test_{i+1}": {
                        "original": broken_json,
                        "repaired": repaired if 'repaired' in locals() else "repair_failed",
                        "parsed_successfully": False,
                        "error": str(e)
                    }
                })
        
        return {
            "status": "success",
            "message": "JSON repair functionality tested",
            "results": results
        }
        
    except Exception as e:
        return {
            "status": "error",
            "error": str(e)
        }

@app.get("/api/test-supabase-storage")
async def test_supabase_storage():
    """Test Supabase storage functionality"""
    try:
        if not storage.supabase_store.supabase:
            return {
                "status": "error",
                "error": "Supabase not available"
            }
        
        # Test job creation
        test_job_id = f"test-job-{uuid.uuid4()}"
        job_result = await storage.supabase_store.create_job(test_job_id, {
            "job_role": "Test Role",
            "required_experience": "1-2 years",
            "description": "This is a test job description for testing Supabase integration"
        })
        
        # Test resume result creation
        test_resume_data = {
            "filename": "test_resume.pdf",
            "classification": {"category": "tech", "level": "mid"},
            "fit_score": 85.5,
            "matching_skills": ["Python", "FastAPI", "Testing"],
            "missing_skills": ["React", "TypeScript"],
            "recommendation": "GOOD_FIT",
            "detailed_analysis": {"explanation": "Good technical match"}
        }
        
        resume_result = await storage.supabase_store.create_resume_result(test_job_id, test_resume_data)
        
        return {
            "status": "success",
            "job_creation": job_result,
            "resume_creation": resume_result,
            "test_job_id": test_job_id
        }
        
    except Exception as e:
        logger.error(f"Error in test_supabase_storage endpoint: {str(e)}")
        return {
            "status": "error",
            "error": str(e)
        }

# Interview Setup API Endpoints (Job-specific)
@app.get("/api/jobs/{job_id}/interview-setup")
async def get_job_interview_setup(job_id: str):
    """Get interview setup configuration for a specific job"""
    try:
        if not storage.supabase_store.supabase:
            return {
                "status": "error",
                "error": "Supabase not available"
            }
        
        # Verify job exists
        job_data = storage.get_job(job_id)
        if not job_data:
            return {
                "status": "error",
                "error": "Job not found"
            }
        
        result = storage.supabase_store.supabase.table("interview_setup").select("*").eq("job_post_id", job_id).eq("is_active", True).execute()
        
        return {
            "status": "success",
            "data": result.data or []
        }
        
    except Exception as e:
        logger.error(f"Error fetching interview setup for job {job_id}: {str(e)}")
        return {
            "status": "error",
            "error": str(e)
        }

@app.post("/api/jobs/{job_id}/interview-setup")
async def create_job_interview_setup(job_id: str, setup_data: dict):
    """Create interview setup configurations for a specific job (supports multiple setups)"""
    try:
        if not storage.supabase_store.supabase:
            return {
                "status": "error",
                "error": "Supabase not available"
            }
        
        # Verify job exists
        job_data = storage.get_job(job_id)
        if not job_data:
            return {
                "status": "error",
                "error": "Job not found"
            }
        
        # Check if setup_data contains multiple configurations or single configuration
        if "configurations" in setup_data:
            # Multiple configurations
            configurations = setup_data["configurations"]
            created_setups = []
            
            # First, soft delete existing setups for this job
            storage.supabase_store.supabase.table("interview_setup").update({
                "is_active": False,
                "updated_at": datetime.utcnow().isoformat()
            }).eq("job_post_id", job_id).execute()
            
            # Create new setups for each configuration
            for config in configurations:
                # Validate percentages sum to 100
                total_percentage = (
                    config.get("screening_percentage", 0) +
                    config.get("domain_percentage", 0) +
                    config.get("behavioral_attitude_percentage", 0)
                )
                
                if total_percentage != 100:
                    return {
                        "status": "error",
                        "error": f"Percentages must sum to 100 for {config.get('role_type', 'unknown')}-{config.get('level', 'unknown')}, got {total_percentage}"
                    }
                
                # Add job_post_id and timestamps
                data = {
                    **config,
                    "communication_percentage": 0,  # Set to 0 as communication is analyzed through responses
                    "number_of_questions": config.get("number_of_questions", 7),
                    "estimated_duration": config.get("estimated_duration", 10),
                    "job_post_id": job_id,
                    "created_at": datetime.utcnow().isoformat(),
                    "updated_at": datetime.utcnow().isoformat(),
                    "is_active": True
                }
                
                # Create new setup
                result = storage.supabase_store.supabase.table("interview_setup").insert(data).execute()
                
                if result.data:
                    created_setups.extend(result.data)
                else:
                    return {
                        "status": "error",
                        "error": f"Failed to create interview setup for {config.get('role_type', 'unknown')}-{config.get('level', 'unknown')}"
                    }
            
            return {
                "status": "success",
                "data": created_setups,
                "message": f"Created {len(created_setups)} interview setup configurations"
            }
        
        else:
            # Single configuration (backward compatibility)
            # Add job_post_id and timestamps
            data = {
                **setup_data,
                "communication_percentage": 0,  # Set to 0 as communication is analyzed through responses
                "number_of_questions": setup_data.get("number_of_questions", 7),
                "estimated_duration": setup_data.get("estimated_duration", 10),
                "job_post_id": job_id,
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat(),
                "is_active": True
            }
            
            # Validate percentages sum to 100
            total_percentage = (
                data.get("screening_percentage", 0) +
                data.get("domain_percentage", 0) +
                data.get("behavioral_attitude_percentage", 0)
            )
            
            if total_percentage != 100:
                return {
                    "status": "error",
                    "error": f"Percentages must sum to 100, got {total_percentage}"
                }
            
            # Check if interview setup already exists for this job and role_type/level combination
            existing = storage.supabase_store.supabase.table("interview_setup").select("id").eq("job_post_id", job_id).eq("role_type", data.get("role_type")).eq("level", data.get("level")).eq("is_active", True).execute()
            
            if existing.data:
                # Update existing instead of creating new
                result = storage.supabase_store.supabase.table("interview_setup").update({
                    **setup_data,
                    "updated_at": datetime.utcnow().isoformat()
                }).eq("job_post_id", job_id).eq("role_type", data.get("role_type")).eq("level", data.get("level")).eq("is_active", True).execute()
            else:
                # Create new
                result = storage.supabase_store.supabase.table("interview_setup").insert(data).execute()
            
            if result.data:
                return {
                    "status": "success",
                    "data": result.data[0] if result.data else None
                }
            else:
                return {
                    "status": "error",
                    "error": "Failed to create/update interview setup"
                }
            
    except Exception as e:
        logger.error(f"Error creating interview setup for job {job_id}: {str(e)}")
        return {
            "status": "error",
            "error": str(e)
        }

@app.put("/api/jobs/{job_id}/interview-setup/{setup_id}")
async def update_job_interview_setup(job_id: str, setup_id: str, setup_data: dict):
    """Update interview setup configuration for a specific job"""
    try:
        if not storage.supabase_store.supabase:
            return {
                "status": "error",
                "error": "Supabase not available"
            }
        
        # Verify job exists
        job_data = storage.get_job(job_id)
        if not job_data:
            return {
                "status": "error",
                "error": "Job not found"
            }
        
        # Add timestamp
        data = {
            **setup_data,
            "updated_at": datetime.utcnow().isoformat()
        }
        
        # Validate percentages sum to 100 if percentages are being updated
        if any(key in data for key in ["screening_percentage", "domain_percentage", "behavioral_attitude_percentage"]):
            # Get current data first
            current = storage.supabase_store.supabase.table("interview_setup").select("*").eq("id", setup_id).eq("job_post_id", job_id).single().execute()
            if current.data:
                current_data = current.data
                total_percentage = (
                    data.get("screening_percentage", current_data.get("screening_percentage", 0)) +
                    data.get("domain_percentage", current_data.get("domain_percentage", 0)) +
                    data.get("behavioral_attitude_percentage", current_data.get("behavioral_attitude_percentage", 0))
                )
                
                if total_percentage != 100:
                    return {
                        "status": "error",
                        "error": f"Percentages must sum to 100, got {total_percentage}"
                    }
        
        result = storage.supabase_store.supabase.table("interview_setup").update(data).eq("id", setup_id).eq("job_post_id", job_id).execute()
        
        if result.data:
            return {
                "status": "success",
                "data": result.data[0]
            }
        else:
            return {
                "status": "error",
                "error": "Failed to update interview setup"
            }
            
    except Exception as e:
        logger.error(f"Error updating interview setup for job {job_id}: {str(e)}")
        return {
            "status": "error",
            "error": str(e)
        }

@app.delete("/api/jobs/{job_id}/interview-setup/{setup_id}")
async def delete_job_interview_setup(job_id: str, setup_id: str):
    """Delete interview setup configuration for a specific job (soft delete)"""
    try:
        if not storage.supabase_store.supabase:
            return {
                "status": "error",
                "error": "Supabase not available"
            }
        
        # Verify job exists
        job_data = storage.get_job(job_id)
        if not job_data:
            return {
                "status": "error",
                "error": "Job not found"
            }
        
        # Soft delete by setting is_active to false
        result = storage.supabase_store.supabase.table("interview_setup").update({
            "is_active": False,
            "updated_at": datetime.utcnow().isoformat()
        }).eq("id", setup_id).eq("job_post_id", job_id).execute()
        
        if result.data:
            return {
                "status": "success",
                "message": "Interview setup deleted successfully"
            }
        else:
            return {
                "status": "error",
                "error": "Failed to delete interview setup"
            }
            
    except Exception as e:
        logger.error(f"Error deleting interview setup for job {job_id}: {str(e)}")
        return {
            "status": "error",
            "error": str(e)
        }

@app.post("/api/jobs/{job_id}/interview-setup/bulk")
async def bulk_create_job_interview_setups(job_id: str, setups_data: dict):
    """Create multiple interview setup configurations for a job in one request"""
    try:
        if not storage.supabase_store.supabase:
            return {
                "status": "error",
                "error": "Supabase not available"
            }
        
        # Verify job exists
        job_data = storage.get_job(job_id)
        if not job_data:
            return {
                "status": "error",
                "error": "Job not found"
            }
        
        configurations = setups_data.get("configurations", [])
        if not configurations:
            return {
                "status": "error",
                "error": "No configurations provided"
            }
        
        # Validate all configurations first
        for i, config in enumerate(configurations):
            total_percentage = (
                config.get("screening_percentage", 0) +
                config.get("domain_percentage", 0) +
                config.get("behavioral_attitude_percentage", 0)
            )
            
            if total_percentage != 100:
                return {
                    "status": "error",
                    "error": f"Configuration {i+1} ({config.get('role_type', 'unknown')}-{config.get('level', 'unknown')}): percentages must sum to 100, got {total_percentage}"
                }
            
            # Validate required fields
            required_fields = ["role_type", "level", "experience_range", "screening_percentage", "domain_percentage", "behavioral_attitude_percentage"]
            for field in required_fields:
                if field not in config:
                    return {
                        "status": "error",
                        "error": f"Configuration {i+1}: missing required field '{field}'"
                    }
        
        # If replace_all is True, soft delete existing setups for this job
        if setups_data.get("replace_all", False):
            storage.supabase_store.supabase.table("interview_setup").update({
                "is_active": False,
                "updated_at": datetime.utcnow().isoformat()
            }).eq("job_post_id", job_id).execute()
        
        # Create new setups
        created_setups = []
        for config in configurations:
            # Check if this combination already exists
            existing = storage.supabase_store.supabase.table("interview_setup").select("id").eq("job_post_id", job_id).eq("role_type", config["role_type"]).eq("level", config["level"]).eq("is_active", True).execute()
            
            data = {
                **config,
                "communication_percentage": 0,  # Set to 0 as communication is analyzed through responses
                "number_of_questions": config.get("number_of_questions", 7),
                "estimated_duration": config.get("estimated_duration", 10),
                "job_post_id": job_id,
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat(),
                "is_active": True
            }
            
            if existing.data and not setups_data.get("replace_all", False):
                # Update existing
                result = storage.supabase_store.supabase.table("interview_setup").update({
                    **config,
                    "updated_at": datetime.utcnow().isoformat()
                }).eq("id", existing.data[0]["id"]).execute()
            else:
                # Create new
                result = storage.supabase_store.supabase.table("interview_setup").insert(data).execute()
            
            if result.data:
                created_setups.extend(result.data)
            else:
                return {
                    "status": "error",
                    "error": f"Failed to create/update interview setup for {config['role_type']}-{config['level']}"
                }
        
        return {
            "status": "success",
            "data": created_setups,
            "message": f"Successfully processed {len(created_setups)} interview setup configurations"
        }
        
    except Exception as e:
        logger.error(f"Error in bulk create interview setups for job {job_id}: {str(e)}")
        return {
            "status": "error",
            "error": str(e)
        }

@app.get("/api/jobs/{job_id}/interview-setup/matrix")
async def get_job_interview_setup_matrix(job_id: str):
    """Get interview setup matrix for a job (all role_type/level combinations)"""
    try:
        if not storage.supabase_store.supabase:
            return {
                "status": "error",
                "error": "Supabase not available"
            }
        
        # Verify job exists
        job_data = storage.get_job(job_id)
        if not job_data:
            return {
                "status": "error",
                "error": "Job not found"
            }
        
        # Get all active interview setups for this job
        result = storage.supabase_store.supabase.table("interview_setup").select("*").eq("job_post_id", job_id).eq("is_active", True).execute()
        
        setups = result.data or []
        
        # Organize into matrix format
        matrix = {}
        role_types = ["tech", "non-tech", "semi-tech"]
        levels = ["entry", "mid", "senior"]
        
        # Initialize matrix
        for role_type in role_types:
            matrix[role_type] = {}
            for level in levels:
                matrix[role_type][level] = None
        
        # Fill matrix with actual data
        for setup in setups:
            role_type = setup.get("role_type")
            level = setup.get("level")
            if role_type in matrix and level in levels:
                matrix[role_type][level] = setup
        
        return {
            "status": "success",
            "data": {
                "matrix": matrix,
                "configurations": setups,
                "total_configurations": len(setups)
            }
        }
        
    except Exception as e:
        logger.error(f"Error fetching interview setup matrix for job {job_id}: {str(e)}")
        return {
            "status": "error",
            "error": str(e)
        }

# Error handlers
@app.exception_handler(Exception)
async def general_exception_handler(request, exc):
    logger.error(f"Unhandled exception: {str(exc)}")
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"}
    )

# Interview Session API Endpoints
@app.post("/api/candidates/{candidate_id}/generate-interview-link")
async def generate_interview_link(candidate_id: str):
    """Generate personalized interview link for a candidate"""
    try:
        if not storage.supabase_store.supabase:
            return {
                "status": "error",
                "error": "Supabase not available"
            }
        
        logger.info(f"🚀 Starting interview link generation for candidate {candidate_id}")
        
        # Step 0: Validate database connection
        if not storage.supabase_store.supabase:
            return {
                "status": "error",
                "error": "Database connection not available"
            }
        
        # Step 1: Fetch candidate data from resume_results
        logger.info(f"📋 Fetching candidate data for ID: {candidate_id}")
        candidate_result = None
        try:
            candidate_result = storage.supabase_store.supabase.table("resume_results").select("*").eq("id", candidate_id).single().execute()
        except Exception as e:
            logger.error(f"❌ Error fetching candidate data from Supabase: {str(e)}")
            
            # Check if this is a "no rows" error (candidate doesn't exist)
            if "The result contains 0 rows" in str(e) or "PGRST116" in str(e):
                logger.warning(f"⚠️ Candidate {candidate_id} not found in database, checking memory store...")
                
                # Try to find in memory store
                memory_candidate = None
                job_analyses = storage.memory_store.resume_analyses
                for job_id, analyses in job_analyses.items():
                    for analysis in analyses:
                        if analysis.get('id') == candidate_id:
                            memory_candidate = analysis
                            logger.info(f"📋 Found candidate in memory store for job {job_id}")
                            break
                    if memory_candidate:
                        break
                
                if memory_candidate:
                    # Create a mock response object with memory data
                    from types import SimpleNamespace
                    candidate_result = SimpleNamespace()
                    candidate_result.data = {
                        "id": memory_candidate.get("id"),
                        "candidate_name": memory_candidate.get("name"),
                        "job_post_id": memory_candidate.get("job_id"),
                        "candidate_type": memory_candidate.get("candidate_type"),
                        "candidate_level": memory_candidate.get("candidate_level"),
                        "fit_score": memory_candidate.get("fit_score"),
                        "resume_analysis_data": memory_candidate
                    }
                    logger.info(f"✅ Using memory data for candidate {candidate_id}")
                else:
                    return {
                        "status": "error",
                        "error": f"Candidate {candidate_id} not found in database or memory. This candidate may have been deleted or the data was not properly saved."
                    }
            else:
                return {
                    "status": "error",
                    "error": f"Database error while fetching candidate: {str(e)}"
                }
        
        if candidate_result and not candidate_result.data:
            return {
                "status": "error",
                "error": "Candidate not found in database"
            }
        
        candidate = candidate_result.data
        job_post_id = candidate["job_post_id"]
        candidate_type = candidate["candidate_type"]
        candidate_level = candidate["candidate_level"]
        candidate_name = candidate["candidate_name"]
        resume_analysis = candidate["resume_analysis_data"]
        resume_score = candidate.get("fit_score", 0)  # Get resume score, default to 0 if not found
        
        # Determine difficulty level based on resume score
        difficulty_level = InterviewQuestionGenerator.determine_difficulty_level(resume_score)
        
        logger.info(f"✅ Found candidate: {candidate_name} ({candidate_type}/{candidate_level}) for job {job_post_id}")
        logger.info(f"📊 Resume score: {resume_score}% → Difficulty level: {difficulty_level.upper()}")
        
        # Step 2: Validate job exists and fetch job data
        logger.info(f"🏢 Validating and fetching job data for ID: {job_post_id}")
        try:
            job_result = storage.supabase_store.supabase.table("job_posts").select("*").eq("id", job_post_id).single().execute()
        except Exception as e:
            logger.error(f"❌ Error fetching job data: {str(e)}")
            return {
                "status": "error",
                "error": f"Error fetching job data: {str(e)}"
            }
        
        if not job_result.data:
            return {
                "status": "error",
                "error": "Job post not found"
            }
        
        job_data = job_result.data
        job_description_analysis = job_data["job_description_analysis"]
        job_role = job_data["job_role"]
        
        logger.info(f"✅ Found job: {job_role}")
        
        # Step 3: Fetch evaluation criteria with detailed logging
        logger.info(f"⚙️ Fetching interview setup for: role_type={candidate_type}, level={candidate_level}, job_post_id={job_post_id}")
        
        # First, check what records exist before filtering
        check_result = storage.supabase_store.supabase.table("interview_setup").select("id, role_type, level, job_post_id, is_active").eq("role_type", candidate_type).eq("level", candidate_level).eq("is_active", True).execute()
        logger.info(f"🔍 Found {len(check_result.data)} interview setup records for {candidate_type}/{candidate_level}")
        for record in check_result.data:
            logger.info(f"   - ID: {record['id']}, job_post_id: {record['job_post_id']}")
        
        # Now try the full query
        try:
            criteria_result = storage.supabase_store.supabase.table("interview_setup").select("*").eq("role_type", candidate_type).eq("level", candidate_level).eq("job_post_id", job_post_id).eq("is_active", True).single().execute()
        except Exception as e:
            logger.error(f"❌ Error fetching interview setup: {str(e)}")
            logger.error(f"Query details: role_type={candidate_type}, level={candidate_level}, job_post_id={job_post_id}, is_active=True")
            return {
                "status": "error",
                "error": f"Error fetching interview setup: {str(e)}"
            }
        
        if not criteria_result.data:
            return {
                "status": "error",
                "error": f"No interview setup found for {candidate_type} {candidate_level} candidates in this job post"
            }
        
        evaluation_criteria = criteria_result.data
        logger.info(f"✅ Found interview setup: {evaluation_criteria['id']}")
        
        # Step 4: Generate questions - either adaptive pool or standard set
        openai_client = AzureOpenAIClient()
        question_generator = InterviewQuestionGenerator(openai_client)
        
        # Check if adaptive interviews are enabled
        if question_generator.adaptive_enabled:
            logger.info(f"🔄 Generating ADAPTIVE question pool with initial difficulty: {difficulty_level.upper()}")
            questions_data = await question_generator.generate_adaptive_question_pool(
            job_analysis=job_description_analysis,
            evaluation_criteria=evaluation_criteria,
            candidate_type=candidate_type,
                candidate_level=candidate_level,
                initial_difficulty=difficulty_level
            )
            is_adaptive = True
        else:
            logger.info(f"🤖 Generating {difficulty_level.upper()} difficulty questions based on job requirements...")
            questions_data = await question_generator.generate_standardized_questions(
                job_analysis=job_description_analysis,
                evaluation_criteria=evaluation_criteria,
                candidate_type=candidate_type,
                candidate_level=candidate_level,
                difficulty_level=difficulty_level
            )
            is_adaptive = False
        
        # Step 5: Create interview prompt
        interview_prompt = await question_generator.create_interview_prompt(
            questions_data=questions_data,
            candidate_name=candidate_name,
            job_role=job_role
        )
        
        # Step 6: Create interview session
        session_id = str(uuid.uuid4())
        session_url = f"/video-interview?session={session_id}"
        
        # Calculate expiration (24 hours from now)
        expires_at = (datetime.utcnow() + timedelta(hours=24)).isoformat()
        
        # For adaptive interviews, create a flattened version of questions for backward compatibility
        if is_adaptive and questions_data and "question_pool" in questions_data:
            flattened_questions = []
            for category, difficulties in questions_data["question_pool"].items():
                for difficulty, questions in difficulties.items():
                    for q in questions:
                        flattened_questions.append({
                            "category": category,
                            "difficulty": difficulty,
                            "id": q["id"],
                            "question": q["question"]
                        })
            logger.info(f"📋 Flattened {len(flattened_questions)} adaptive questions for database storage")
            generated_questions_value = flattened_questions
        else:
            generated_questions_value = questions_data if questions_data else []
        
        # Ensure generated_questions is never null
        if generated_questions_value is None:
            logger.warning("⚠️ generated_questions was None, setting to empty array")
            generated_questions_value = []
        
        session_data = {
            "id": session_id,
            "resume_result_id": candidate_id,
            "job_post_id": job_post_id,
            "candidate_name": candidate_name,
            "generated_questions": generated_questions_value,  # Always populate for NOT NULL constraint
            "adaptive_questions": questions_data if is_adaptive else None,  # New adaptive field
            "interview_prompt": interview_prompt,
            "session_url": session_url,
            "status": "pending",
            "difficulty_level": difficulty_level,
            "initial_difficulty": difficulty_level if is_adaptive else None,
            "difficulty_progression": [] if is_adaptive else None,
            "resume_score": resume_score,
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
            "expires_at": expires_at
        }
        
        # Debug log to verify generated_questions is not null
        logger.info(f"📊 Session data - is_adaptive: {is_adaptive}, generated_questions type: {type(generated_questions_value)}, length: {len(generated_questions_value) if generated_questions_value else 0}")
        
        # Store session in database
        logger.info(f"💾 Creating interview session...")
        session_result = storage.supabase_store.supabase.table("interview_sessions").insert(session_data).execute()
        
        if not session_result.data:
            return {
                "status": "error",
                "error": "Failed to create interview session"
            }
        
        logger.info(f"✅ Generated interview link for candidate {candidate_name}: {session_url}")
        
        return {
            "status": "success",
            "data": {
                "session_id": session_id,
                "session_url": session_url,
                "candidate_name": candidate_name,
                "job_role": job_role,
                "questions_count": len(questions_data.get('questions', [])),
                "expires_at": expires_at,
                "interview_focus": questions_data.get('interview_focus', '')
            },
            "message": f"Interview link generated successfully for {candidate_name}"
        }
        
    except Exception as e:
        logger.error(f"❌ Error generating interview link for candidate {candidate_id}: {str(e)}")
        logger.error(f"Full error: {traceback.format_exc()}")
        return {
            "status": "error",
            "error": str(e)
        }

@app.get("/api/interviews/{session_id}")
async def get_interview_session(session_id: str):
    """Get interview session data for VideoInterview page"""
    try:
        if not storage.supabase_store.supabase:
            return {
                "status": "error",
                "error": "Supabase not available"
            }
        
        # Fetch session data
        session_result = storage.supabase_store.supabase.table("interview_sessions").select("*").eq("id", session_id).single().execute()
        
        if not session_result.data:
            return {
                "status": "error",
                "error": "Interview session not found"
            }
        
        session = session_result.data
        
        # Check if session has expired
        if session["expires_at"]:
            expires_at = datetime.fromisoformat(session["expires_at"].replace('Z', '+00:00'))
            if datetime.utcnow() > expires_at.replace(tzinfo=None):
                return {
                    "status": "error",
                    "error": "Interview session has expired"
                }
        
        # Update session status to 'active' when accessed
        if session["status"] == "pending":
            storage.supabase_store.supabase.table("interview_sessions").update({
                "status": "active",
                "updated_at": datetime.utcnow().isoformat()
            }).eq("id", session_id).execute()
        
        return {
            "status": "success",
            "data": {
                "session_id": session["id"],
                "candidate_name": session["candidate_name"],
                "interview_prompt": session["interview_prompt"],
                "generated_questions": session["generated_questions"],
                "status": "active",
                "created_at": session["created_at"],
                "expires_at": session["expires_at"]
            }
        }
        
    except Exception as e:
        logger.error(f"Error fetching interview session {session_id}: {str(e)}")
        return {
            "status": "error",
            "error": str(e)
        }

@app.patch("/api/interviews/{session_id}/status")
async def update_interview_session_status(session_id: str, status_data: dict):
    """Update interview session status (e.g., completed, cancelled)"""
    try:
        if not storage.supabase_store.supabase:
            return {
                "status": "error",
                "error": "Supabase not available"
            }
        
        new_status = status_data.get("status")
        if new_status not in ["pending", "active", "completed", "cancelled", "expired"]:
            return {
                "status": "error",
                "error": "Invalid status. Must be one of: pending, active, completed, cancelled, expired"
            }
        
        # Update session status
        result = storage.supabase_store.supabase.table("interview_sessions").update({
            "status": new_status,
            "updated_at": datetime.utcnow().isoformat()
        }).eq("id", session_id).execute()
        
        if not result.data:
            return {
                "status": "error", 
                "error": "Interview session not found"
            }
        
        return {
            "status": "success",
            "data": result.data[0],
            "message": f"Interview session status updated to {new_status}"
        }
        
    except Exception as e:
        logger.error(f"Error updating interview session status {session_id}: {str(e)}")
        return {
            "status": "error",
            "error": str(e)
        }

@app.patch("/api/interviews/{session_id}/update-conversation")
async def update_interview_session_conversation(session_id: str, payload: dict):
    """Update interview session with conversation ID for webhook linking"""
    try:
        if not storage.supabase_store.supabase:
            return {"status": "error", "error": "Supabase not available"}
        
        conversation_id = payload.get("conversation_id")
        if not conversation_id:
            return {"status": "error", "error": "conversation_id required"}
        
        # Update session with conversation ID
        result = storage.supabase_store.supabase.table("interview_sessions").update({
            "conversation_id": conversation_id,
            "updated_at": datetime.utcnow().isoformat()
        }).eq("id", session_id).execute()
        
        if not result.data:
            return {"status": "error", "error": "Interview session not found"}
        
        logger.info(f"✅ Updated session {session_id} with conversation ID: {conversation_id}")
        return {"status": "success", "data": result.data[0]}
        
    except Exception as e:
        logger.error(f"Error updating session conversation ID: {str(e)}")
        return {"status": "error", "error": str(e)}

# ---------------- Interview Completion & Results -----------------


@app.post("/api/interviews/{session_id}/complete")
async def complete_interview(session_id: str, payload: dict):
    """Mark interview complete, fetch transcript, run GPT analysis, store results"""
    try:
        if not storage.supabase_store.supabase:
            return {"status": "error", "error": "Supabase not available"}

        conversation_id = payload.get("conversation_id")
        if not conversation_id:
            return {"status": "error", "error": "conversation_id required"}

        # Fetch session row
        session_res = storage.supabase_store.supabase.table("interview_sessions").select("*").eq("id", session_id).single().execute()
        session = session_res.data if session_res else None
        if not session:
            return {"status": "error", "error": "Interview session not found"}

        # 1) Pull full transcript from ElevenLabs
        xi_key = "sk_99b0a60fc75de64325fe89d89b145782f08054d7263064ac"

        transcript_text, started_at, ended_at = ElevenLabsService.fetch_transcript(conversation_id, xi_key)

        # 2) Analyse with GPT
        analyzer = InterviewAnalyzer(AzureOpenAIClient())
        analysis = await analyzer.analyse(transcript_text, session["candidate_name"], storage.get_job(session["job_post_id"])["job_role"] if storage.get_job(session["job_post_id"]) else "")

        duration_seconds = int((ended_at - started_at).total_seconds()) if started_at and ended_at else None

        row = {
            "interview_session_id": session_id,
            "job_post_id": session.get("job_post_id"),
            "resume_result_id": session.get("resume_result_id"),
            "conversation_id": conversation_id,
            "transcript": transcript_text,
            "started_at": started_at.isoformat() if started_at else None,
            "ended_at": ended_at.isoformat() if ended_at else None,
            "duration_seconds": duration_seconds,
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
            **analysis,
        }

        # store results
        insert_res = storage.supabase_store.supabase.table("interview_results").insert(row).execute()

        # update session status
        storage.supabase_store.supabase.table("interview_sessions").update({"status": "completed", "updated_at": datetime.utcnow().isoformat()}).eq("id", session_id).execute()

        return {"status": "success", "data": insert_res.data[0] if insert_res.data else row}

    except Exception as e:
        logger.error("Error completing interview: %s", str(e))
        return {"status": "error", "error": str(e)}


def extract_difficulty_progression(transcript: str, adaptive_config: dict = None) -> List[Dict[str, Any]]:
    """Extract difficulty progression from interview transcript"""
    
    progression = []
    
    # Look for difficulty adjustment indicators in the transcript
    difficulty_patterns = [
        r"\[Moving to (\w+) level\]",
        r"\[Adjusting to (\w+) based on (.+?)\]",
        r"Let me ask you something more (\w+)",
        r"Let me ask you something (\w+) fundamental",
    ]
    
    lines = transcript.split('\n')
    for i, line in enumerate(lines):
        for pattern in difficulty_patterns:
            match = re.search(pattern, line, re.IGNORECASE)
            if match:
                difficulty = match.group(1).lower()
                if difficulty in ["easy", "medium", "hard", "fundamental", "advanced"]:
                    # Map variations to standard levels
                    if difficulty == "fundamental":
                        difficulty = "easy"
                    elif difficulty == "advanced":
                        difficulty = "hard"
                    
                    progression.append({
                        "timestamp": datetime.utcnow().isoformat(),
                        "difficulty": difficulty,
                        "line_number": i,
                        "context": line.strip()
                    })
    
    return progression

@app.post("/api/interviews/{session_id}/complete-with-transcript")
async def complete_interview_with_transcript(session_id: str, payload: dict):
    """Complete interview using transcript data from frontend instead of ElevenLabs API"""
    try:
        if not storage.supabase_store.supabase:
            return {"status": "error", "error": "Supabase not available"}

        # Get transcript data from payload
        transcript_text = payload.get("transcript")
        transcript_entries = payload.get("transcript_entries", [])
        started_at_str = payload.get("started_at")
        ended_at_str = payload.get("ended_at")
        duration_seconds = payload.get("duration_seconds")
        cheating_flags = payload.get("cheating_flags", [])
        fullscreen_exit_count = payload.get("fullscreen_exit_count", 0)
        recording_url = payload.get("recording_url")  # Azure Blob Storage URL
        user_photo_url = payload.get("user_photo_url")  # User identification photo URL
        
        # Allow empty transcripts but create a minimal one if completely empty
        if not transcript_text or transcript_text.strip() == "":
            logger.warning(f"Empty or minimal transcript for session {session_id}")
            transcript_text = "USER: Interview ended before substantial conversation.\nAI: Interview was terminated early."
            if not transcript_entries:
                transcript_entries = [
                    {
                        "id": "minimal-1",
                        "speaker": "user",
                        "text": "Interview ended before substantial conversation.",
                        "timestamp": started_at_str or datetime.utcnow().isoformat()
                    },
                    {
                        "id": "minimal-2", 
                        "speaker": "agent",
                        "text": "Interview was terminated early.",
                        "timestamp": ended_at_str or datetime.utcnow().isoformat()
                    }
                ]

        # Fetch session row
        session_res = storage.supabase_store.supabase.table("interview_sessions").select("*").eq("id", session_id).single().execute()
        session = session_res.data if session_res else None
        if not session:
            return {"status": "error", "error": "Interview session not found"}

        # Parse timestamps
        started_at = datetime.fromisoformat(started_at_str.replace('Z', '+00:00')) if started_at_str else datetime.utcnow()
        ended_at = datetime.fromisoformat(ended_at_str.replace('Z', '+00:00')) if ended_at_str else datetime.utcnow()

        logger.info(f"Processing interview transcript for session {session_id}")
        logger.info(f"Transcript length: {len(transcript_text)} characters")
        logger.info(f"Number of messages: {len(transcript_entries)}")
        logger.info(f"Duration: {duration_seconds} seconds")
        logger.info(f"Security violations: {len(cheating_flags)}")
        logger.info(f"Recording URL: {recording_url if recording_url else 'No recording URL provided'}")
        logger.info(f"User photo URL: {user_photo_url if user_photo_url else 'No photo URL provided'}")

        # Get job information for context
        job_post_id = session.get("job_post_id")
        job_data = storage.get_job(job_post_id) if job_post_id else None
        job_role = job_data["job_role"] if job_data else "Unknown Role"
        candidate_name = session.get("candidate_name", "Unknown Candidate")
        
        # Extract difficulty progression if this is an adaptive interview
        difficulty_progression = []
        final_difficulty_levels = {}
        
        if session.get("adaptive_questions"):
            logger.info(f"🔄 Extracting difficulty progression from adaptive interview")
            difficulty_progression = extract_difficulty_progression(transcript_text)
            
            # Analyze final difficulty levels reached per category
            if difficulty_progression:
                categories_seen = {}
                for prog in difficulty_progression:
                    # Try to infer category from context or position
                    # This is a simplified approach - could be enhanced
                    if "screening" in prog.get("context", "").lower():
                        categories_seen["screening"] = prog["difficulty"]
                    elif "technical" in prog.get("context", "").lower() or "domain" in prog.get("context", "").lower():
                        categories_seen["domain"] = prog["difficulty"]
                    elif "behavioral" in prog.get("context", "").lower():
                        categories_seen["behavioral"] = prog["difficulty"]
                
                final_difficulty_levels = categories_seen
                logger.info(f"📊 Difficulty progression: {len(difficulty_progression)} changes detected")
                logger.info(f"📊 Final difficulty levels: {final_difficulty_levels}")

        # Get interview questions from session for proper scoring
        interview_questions = session.get("generated_questions", [])

        # Analyse with GPT
        analyzer = InterviewAnalyzer(AzureOpenAIClient())
        analysis = await analyzer.analyse(transcript_text, candidate_name, job_role, interview_questions)

        # Prepare security violations data
        security_violations = {
            "cheating_flags": cheating_flags,
            "fullscreen_exit_count": fullscreen_exit_count,
            "security_score": max(0, 100 - (fullscreen_exit_count * 10))  # Deduct 10 points per exit
        }
        
        # Include security information in analysis
        if cheating_flags or fullscreen_exit_count > 0:
            # Potentially adjust cheating_detected based on security violations
            if fullscreen_exit_count > 2:
                analysis["cheating_detected"] = True
                analysis["body_language"] = f"Multiple fullscreen exits detected ({fullscreen_exit_count} times)"

        # Prepare the row for database insertion
        row = {
            "id": str(uuid.uuid4()),
            "interview_session_id": session_id,
            "job_post_id": job_post_id,
            "resume_result_id": session.get("resume_result_id"),
            "conversation_id": None,  # No conversation ID when using direct transcript
            "transcript": transcript_text,
            "transcript_entries": transcript_entries,  # Store structured transcript
            "transcript_source": "frontend_capture",
            "security_violations": security_violations,
            "candidate_name": candidate_name,
            "recording_url": recording_url,  # Azure Blob Storage URL
            "user_photo_url": user_photo_url,  # User identification photo URL
            "started_at": started_at.isoformat(),
            "ended_at": ended_at.isoformat(),
            "duration_seconds": duration_seconds,
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
        }

        # Extract fields that exist in the database schema
        db_fields = {
            "domain_score": analysis.get("domain_score"),
            "behavioral_score": analysis.get("behavioral_score"),
            "communication_score": analysis.get("communication_score"),
            "overall_score": analysis.get("overall_score"),
            "confidence_level": analysis.get("confidence_level"),
            "cheating_detected": analysis.get("cheating_detected"),
            "body_language": analysis.get("body_language"),
            "speech_pattern": analysis.get("speech_pattern"),
            "areas_of_improvement": analysis.get("areas_of_improvement"),
            "system_recommendation": analysis.get("system_recommendation"),
            "domain_knowledge_insights": analysis.get("domain_knowledge_insights"),
            "technical_competency_analysis": analysis.get("technical_competency_analysis"),
            "problem_solving_approach": analysis.get("problem_solving_approach"),
            "relevant_experience_assessment": analysis.get("relevant_experience_assessment"),
            "knowledge_gaps": analysis.get("knowledge_gaps"),
            "interview_performance_metrics": analysis.get("interview_performance_metrics"),
            "behavioral_analysis": analysis.get("behavioral_analysis"),
            "question_scores": analysis.get("question_scores"),
            "raw_domain_score": analysis.get("raw_domain_score"),
            "max_domain_score": analysis.get("max_domain_score"),
            "normalized_domain_score": analysis.get("normalized_domain_score"),
            "communication_analysis": analysis.get("communication_analysis"),  # Now this column exists!
        }
        
        # Add the database fields to the row
        row.update(db_fields)

        # Store additional metadata in raw_analysis
        row["raw_analysis"] = {
            "total_messages": len(transcript_entries),
            "source": "frontend_capture",
            "session_data": {
                "job_role": job_role,
                "candidate_type": session.get("candidate_type"),
                "candidate_level": session.get("candidate_level")
            },
            # Include any analysis fields not in the database schema
            "full_analysis": analysis  # Store complete analysis for reference
        }

        # Store results in database
        insert_res = storage.supabase_store.supabase.table("interview_results").insert(row).execute()

        if insert_res.data:
            logger.info(f"✅ Interview results stored successfully for session {session_id}")
            logger.info(f"📊 Analysis summary - Overall: {analysis.get('overall_score', 0)}%, Domain: {analysis.get('domain_score', 0)}%, Communication: {analysis.get('communication_score', 0)}%")
            
            # Update session status and difficulty progression
            update_data = {
                "status": "completed", 
                "updated_at": datetime.utcnow().isoformat()
            }
            
            # Add difficulty progression data if this was an adaptive interview
            if session.get("adaptive_questions"):
                update_data["difficulty_progression"] = difficulty_progression
                update_data["final_difficulty_levels"] = final_difficulty_levels
                
            storage.supabase_store.supabase.table("interview_sessions").update(update_data).eq("id", session_id).execute()
            
            return {"status": "success", "data": insert_res.data[0]}
        else:
            logger.error(f"Failed to store interview results - no data returned")
            raise HTTPException(status_code=500, detail="Failed to store interview results in database")

    except Exception as e:
        logger.error(f"Error completing interview with transcript: {str(e)}")
        logger.error(f"Full traceback: {traceback.format_exc()}")
        return {"status": "error", "error": str(e)}



@app.get("/api/interviews/{session_id}/transcript")
async def get_interview_transcript(session_id: str):
    """Retrieve stored interview transcript and entries from database"""
    try:
        if not storage.supabase_store.supabase:
            return {"status": "error", "error": "Supabase not available"}

        # Fetch interview results with transcript
        result = storage.supabase_store.supabase.table("interview_results").select("*").eq("interview_session_id", session_id).single().execute()
        
        if not result.data:
            return {"status": "error", "error": "Interview transcript not found"}
        
        data = result.data
        
        return {
            "status": "success",
            "data": {
                "transcript": data.get("transcript"),
                "transcript_entries": data.get("transcript_entries", []),
                "transcript_source": data.get("transcript_source"),
                "duration_seconds": data.get("duration_seconds"),
                "started_at": data.get("started_at"),
                "ended_at": data.get("ended_at"),
                "security_violations": data.get("security_violations", {}),
                "candidate_name": data.get("candidate_name")
            }
        }
        
    except Exception as e:
        logger.error(f"Error retrieving transcript for session {session_id}: {str(e)}")
        return {"status": "error", "error": str(e)}


@app.post("/api/interviews/analyze-stored-transcript")
async def analyze_stored_transcript(payload: dict):
    """Analyze a previously stored transcript"""
    try:
        if not storage.supabase_store.supabase:
            return {"status": "error", "error": "Supabase not available"}
        
        session_id = payload.get("session_id")
        if not session_id:
            return {"status": "error", "error": "session_id required"}
        
        # Fetch the stored transcript
        result = storage.supabase_store.supabase.table("interview_results").select("*").eq("interview_session_id", session_id).single().execute()
        
        if not result.data:
            return {"status": "error", "error": "No stored transcript found for this session"}
        
        existing_data = result.data
        transcript_text = existing_data.get("transcript")
        
        if not transcript_text:
            return {"status": "error", "error": "No transcript text found"}
        
        # Get additional context
        candidate_name = existing_data.get("candidate_name", "Unknown Candidate")
        
        # Get job information
        job_post_id = existing_data.get("job_post_id")
        job_data = storage.get_job(job_post_id) if job_post_id else None
        job_role = job_data["job_role"] if job_data else "Unknown Role"
        
        # Re-analyze the transcript
        analyzer = InterviewAnalyzer(AzureOpenAIClient())
        new_analysis = await analyzer.analyse(transcript_text, candidate_name, job_role)
        
        # Update the database with new analysis (preserve recording_url)
        update_data = {
            **new_analysis,
            "updated_at": datetime.utcnow().isoformat(),
            "raw_analysis": {
                **(existing_data.get("raw_analysis", {})),
                "reanalyzed_at": datetime.utcnow().isoformat(),
                "reanalysis_reason": payload.get("reason", "Manual re-analysis")
            }
        }
        
        # Preserve recording_url if it exists
        if existing_data.get("recording_url"):
            update_data["recording_url"] = existing_data["recording_url"]
        
        update_res = storage.supabase_store.supabase.table("interview_results").update(update_data).eq("id", existing_data["id"]).execute()
        
        if update_res.data:
            logger.info(f"✅ Re-analyzed transcript for session {session_id}")
            return {"status": "success", "data": update_res.data[0]}
        else:
            return {"status": "error", "error": "Failed to update analysis"}
            
    except Exception as e:
        logger.error(f"Error analyzing stored transcript: {str(e)}")
        return {"status": "error", "error": str(e)}


@app.post("/api/interviews/reanalyze-all")
async def reanalyze_all_interviews():
    """Re-analyze all existing interviews with the new domain-centric format"""
    try:
        if not storage.supabase_store.supabase:
            return {"status": "error", "error": "Supabase not available"}
        
        # Fetch all interview results that have transcripts
        results = storage.supabase_store.supabase.table("interview_results").select("*").not_.is_("transcript", "null").execute()
        
        if not results.data:
            return {"status": "error", "error": "No interviews found to re-analyze"}
        
        successful = 0
        failed = 0
        
        for interview in results.data:
            try:
                session_id = interview.get("interview_session_id")
                transcript_text = interview.get("transcript")
                candidate_name = interview.get("candidate_name", "Unknown Candidate")
                
                # Get job information
                job_post_id = interview.get("job_post_id")
                job_data = storage.get_job(job_post_id) if job_post_id else None
                job_role = job_data["job_role"] if job_data else "Unknown Role"
                
                # Re-analyze the transcript
                analyzer = InterviewAnalyzer(AzureOpenAIClient())
                new_analysis = await analyzer.analyse(transcript_text, candidate_name, job_role)
                
                # Update the database with new analysis (preserve recording_url)
                update_data = {
                    **new_analysis,
                    "updated_at": datetime.utcnow().isoformat()
                }
                
                # Preserve recording_url if it exists
                if interview.get("recording_url"):
                    update_data["recording_url"] = interview["recording_url"]
                
                update_res = storage.supabase_store.supabase.table("interview_results").update(update_data).eq("id", interview["id"]).execute()
                
                if update_res.data:
                    successful += 1
                    logger.info(f"✅ Re-analyzed interview {session_id}")
                else:
                    failed += 1
                    logger.error(f"❌ Failed to update interview {session_id}")
                    
            except Exception as e:
                failed += 1
                logger.error(f"❌ Error re-analyzing interview {interview.get('id')}: {str(e)}")
        
        return {
            "status": "success",
            "message": f"Re-analysis complete. Successful: {successful}, Failed: {failed}",
            "successful": successful,
            "failed": failed
        }
        
    except Exception as e:
        logger.error(f"Error in bulk re-analysis: {str(e)}")
        return {"status": "error", "error": str(e)}


@app.get("/api/interviews/{session_id}/adaptive-analytics")
async def get_adaptive_interview_analytics(session_id: str):
    """Get adaptive interview analytics including difficulty progression"""
    try:
        if not storage.supabase_store.supabase:
            return {"status": "error", "error": "Database not available"}
        
        # Get interview session
        session_res = storage.supabase_store.supabase.table("interview_sessions").select("*").eq("id", session_id).single().execute()
        
        if not session_res.data:
            return {"status": "error", "error": "Interview session not found"}
        
        session = session_res.data
        
        # Check if this was an adaptive interview
        if not session.get("adaptive_questions"):
            return {"status": "error", "error": "This is not an adaptive interview"}
        
        # Get interview results if available
        results_res = storage.supabase_store.supabase.table("interview_results").select("*").eq("interview_session_id", session_id).single().execute()
        results = results_res.data if results_res and results_res.data else None
        
        # Prepare analytics data
        analytics = {
            "session_id": session_id,
            "candidate_name": session.get("candidate_name"),
            "initial_difficulty": session.get("initial_difficulty"),
            "difficulty_progression": session.get("difficulty_progression", []),
            "final_difficulty_levels": session.get("final_difficulty_levels", {}),
            "resume_score": session.get("resume_score"),
            "adaptive_config": session.get("adaptive_questions", {}).get("adaptive_config", {}),
            "progression_summary": {
                "total_adjustments": len(session.get("difficulty_progression", [])),
                "upgrades": sum(1 for p in session.get("difficulty_progression", []) if p.get("difficulty") == "hard"),
                "downgrades": sum(1 for p in session.get("difficulty_progression", []) if p.get("difficulty") == "easy"),
                "maintains": sum(1 for p in session.get("difficulty_progression", []) if p.get("difficulty") == "medium")
            }
        }
        
        # Add interview results if available
        if results:
            analytics["interview_scores"] = {
                "overall_score": results.get("overall_score"),
                "domain_score": results.get("domain_score"),
                "behavioral_score": results.get("behavioral_score"),
                "communication_score": results.get("communication_score")
            }
            
            # Analyze correlation between difficulty and scores
            final_difficulties = session.get("final_difficulty_levels", {})
            if final_difficulties:
                analytics["difficulty_score_correlation"] = {
                    "observation": "Higher difficulty typically correlates with higher domain expertise",
                    "final_difficulties": final_difficulties,
                    "recommendation": "Candidate handled {} difficulty questions".format(
                        "hard" if "hard" in final_difficulties.values() else 
                        "medium" if "medium" in final_difficulties.values() else 
                        "easy"
                    )
                }
        
        return {
            "status": "success",
            "data": analytics
        }
        
    except Exception as e:
        logger.error(f"Error getting adaptive analytics for session {session_id}: {str(e)}")
        return {"status": "error", "error": str(e)}

@app.get("/api/interviews/{session_id}/results")
async def get_interview_results(session_id: str):
    try:
        if not storage.supabase_store.supabase:
            return {"status": "error", "error": "Supabase not available"}

        res = storage.supabase_store.supabase.table("interview_results").select("*").eq("interview_session_id", session_id).single().execute()
        if not res.data:
            return {"status": "error", "error": "Results not found"}
        return {"status": "success", "data": res.data}
    except Exception as e:
        logger.error(e)
        return {"status": "error", "error": str(e)}


@app.get("/api/jobs/{job_id}/interview-results")
async def list_job_interview_results(job_id: str):
    try:
        if not storage.supabase_store.supabase:
            return {"status": "error", "error": "Supabase not available"}
        res = storage.supabase_store.supabase.table("interview_results").select("*").eq("job_post_id", job_id).execute()
        return {"status": "success", "results": res.data}
    except Exception as e:
        logger.error(e)
        return {"status": "error", "error": str(e)}

@app.post("/api/test-interview-analysis")
async def test_interview_analysis(payload: dict):
    """Test endpoint to analyze a conversation without session requirements"""
    try:
        conversation_id = payload.get("conversation_id")
        if not conversation_id:
            return {"status": "error", "error": "conversation_id required"}
        
        # Mock session data for testing
        candidate_name = payload.get("candidate_name", "Test Candidate")
        job_role = payload.get("job_role", "Software Engineer")
        
        # 1) Pull full transcript from ElevenLabs
        xi_key = "sk_99b0a60fc75de64325fe89d89b145782f08054d7263064ac"
        
        transcript_text, started_at, ended_at = ElevenLabsService.fetch_transcript(conversation_id, xi_key)
        
        # 2) Analyse with GPT
        analyzer = InterviewAnalyzer(AzureOpenAIClient())
        analysis = await analyzer.analyse(transcript_text, candidate_name, job_role)
        
        duration_seconds = int((ended_at - started_at).total_seconds()) if started_at and ended_at else None
        
        result = {
            "conversation_id": conversation_id,
            "transcript": transcript_text,
            "started_at": started_at.isoformat() if started_at else None,
            "ended_at": ended_at.isoformat() if ended_at else None,
            "duration_seconds": duration_seconds,
            "candidate_name": candidate_name,
            "job_role": job_role,
            **analysis,
        }
        
        return {"status": "success", "data": result}
        
    except Exception as e:
        logger.error("Error in test interview analysis: %s", str(e))
        return {"status": "error", "error": str(e)}

# Add HMAC verification import at the top
import hmac
import hashlib

@app.post("/api/convai-webhook")
async def handle_elevenlabs_webhook(request: Request):
    """Handle ElevenLabs Conversational AI webhooks with latest HMAC verification"""
    try:
        # Get the raw body and signature header
        body = await request.body()
        signature_header = request.headers.get("ElevenLabs-Signature")
        
        logger.info(f"Received ElevenLabs webhook with signature: {signature_header}")
        
        # Get the webhook secret (hardcoded)
        webhook_secret = "wsec_675cecf55211354d73f15206ae5d4e19ab0e9ce219449d343055a699b9e0e311"
        
        # Verify signature if secret is provided (LATEST FORMAT)
        if webhook_secret and signature_header:
            if not verify_webhook_signature(body.decode('utf-8'), signature_header, webhook_secret):
                logger.error("❌ ElevenLabs webhook signature verification failed")
                return {"status": "error", "error": "Invalid signature"}
            logger.info("✅ ElevenLabs webhook signature verified successfully")
        elif webhook_secret:
            logger.warning("⚠️ Webhook secret configured but no signature header received")
        else:
            logger.info("ℹ️ No webhook secret configured, skipping signature verification")
        
        # Parse the JSON body
        webhook_data = json.loads(body.decode('utf-8'))
        logger.info(f"📦 Webhook data received: {webhook_data.get('type', 'unknown')}")
        
        event_type = webhook_data.get("type")
        
        # Handle latest post_call_transcription event
        if event_type == "post_call_transcription":
            data = webhook_data.get("data", {})
            conversation_id = data.get("conversation_id")
            agent_id = data.get("agent_id")
            status = data.get("status")
            
            logger.info(f"🎯 Processing post-call transcription for conversation: {conversation_id}")
            logger.info(f"📊 Call status: {status}, Agent: {agent_id}")
            
            if status != "done":
                logger.warning(f"⚠️ Call not completed yet, status: {status}")
                return {"status": "success", "message": "Call not completed yet"}
            
            # Find the interview session by conversation_id
            if storage.supabase_store.supabase:
                try:
                    # Updated query to match latest schema
                    session_result = storage.supabase_store.supabase.table("interview_sessions").select("*").eq("conversation_id", conversation_id).single().execute()
                    
                    if session_result.data:
                        session = session_result.data
                        session_id = session["id"]
                        
                        logger.info(f"✅ Found interview session {session_id} for conversation {conversation_id}")
                        
                        # Get enhanced data from latest webhook format
                        metadata = data.get("metadata", {})
                        analysis = data.get("analysis", {})
                        
                        logger.info(f"📈 Call duration: {metadata.get('call_duration_secs', 0)}s")
                        logger.info(f"💰 Call cost: {metadata.get('cost', 0)}")
                        logger.info(f"🎯 Call successful: {analysis.get('call_successful', 'unknown')}")
                        
                        # Trigger automatic analysis with enhanced data
                        await process_interview_completion_webhook(session_id, conversation_id, session, webhook_data)
                        
                    else:
                        logger.warning(f"⚠️ No interview session found for conversation_id: {conversation_id}")
                        return {"status": "warning", "message": "Interview session not found"}
                        
                except Exception as e:
                    logger.error(f"❌ Error finding interview session: {str(e)}")
                    return {"status": "error", "error": f"Database error: {str(e)}"}
            else:
                logger.warning("⚠️ Supabase not available for webhook processing")
                return {"status": "error", "error": "Database not available"}
        
        elif event_type == "conversation_ended":
            # Handle conversation ended event (for real-time updates)
            data = webhook_data.get("data", {})
            conversation_id = data.get("conversation_id")
            logger.info(f"🔚 Conversation ended: {conversation_id}")
            
            # Optional: Update session status to "ended" for real-time UI updates
            if storage.supabase_store.supabase:
                try:
                    storage.supabase_store.supabase.table("interview_sessions").update({
                        "status": "ended",
                        "updated_at": datetime.utcnow().isoformat()
                    }).eq("conversation_id", conversation_id).execute()
                    logger.info(f"✅ Updated session status to 'ended' for conversation {conversation_id}")
                except Exception as e:
                    logger.warning(f"⚠️ Could not update session status: {str(e)}")
        
        else:
            logger.info(f"ℹ️ Unhandled webhook event type: {event_type}")
        
        return {"status": "success", "message": "Webhook processed successfully"}
        
    except json.JSONDecodeError as e:
        logger.error(f"❌ Invalid JSON in webhook payload: {str(e)}")
        return {"status": "error", "error": "Invalid JSON payload"}
    except Exception as e:
        logger.error(f"❌ Error processing ElevenLabs webhook: {str(e)}")
        logger.error(f"Full traceback: {traceback.format_exc()}")
        return {"status": "error", "error": str(e)}

async def process_interview_completion_webhook(session_id: str, conversation_id: str, session: Dict[str, Any], webhook_data: dict = None):
    """Process interview completion automatically via webhook with enhanced data"""
    try:
        logger.info(f"🚀 Starting automatic interview analysis for session {session_id}")
        
        # 1) Pull full transcript from ElevenLabs API (backup method)
        xi_key = "sk_99b0a60fc75de64325fe89d89b145782f08054d7263064ac"
        
        # Try to use transcript from webhook data first (latest format)
        transcript_text = ""
        started_at = None
        ended_at = None
        
        if webhook_data and webhook_data.get("data", {}).get("transcript"):
            # Use enhanced transcript data from webhook (LATEST FORMAT)
            webhook_transcript = webhook_data["data"]["transcript"]
            metadata = webhook_data["data"].get("metadata", {})
            
            # Convert webhook transcript format to our format
            lines = []
            for message in webhook_transcript:
                role = "AI" if message.get("role") == "agent" else "USER"
                text = message.get("message", "")
                if text:
                    lines.append(f"{role}: {text}")
            
            transcript_text = "\n".join(lines)
            
            # Get timing from metadata
            if metadata.get("start_time_unix_secs"):
                started_at = datetime.fromtimestamp(metadata["start_time_unix_secs"])
            if metadata.get("call_duration_secs") and started_at:
                ended_at = started_at + timedelta(seconds=metadata["call_duration_secs"])
            
            logger.info(f"✅ Using enhanced transcript from webhook ({len(lines)} messages)")
            logger.info(f"📊 Call duration: {metadata.get('call_duration_secs', 0)}s")
            
        # Fallback to API fetch if webhook data incomplete
        if not transcript_text:
            logger.info("🔄 Fetching transcript from ElevenLabs API as fallback")
            transcript_text, started_at, ended_at = ElevenLabsService.fetch_transcript(conversation_id, xi_key)
        
        if not transcript_text:
            logger.warning(f"⚠️ No transcript found for conversation {conversation_id}")
            return
        
        # 2) Get job information for context
        job_post_id = session.get("job_post_id")
        job_data = storage.get_job(job_post_id) if job_post_id else None
        job_role = job_data["job_role"] if job_data else "Unknown Role"
        
        logger.info(f"🎯 Analyzing interview for role: {job_role}")
        
        # 3) Analyse with GPT-4o
        analyzer = InterviewAnalyzer(AzureOpenAIClient())
        analysis = await analyzer.analyse(transcript_text, session["candidate_name"], job_role)
        
        duration_seconds = int((ended_at - started_at).total_seconds()) if started_at and ended_at else None
        
        # 4) Prepare enhanced result data with webhook information
        result_row = {
            "interview_session_id": session_id,
            "job_post_id": session.get("job_post_id"),
            "resume_result_id": session.get("resume_result_id"),
            "conversation_id": conversation_id,
            "transcript": transcript_text,
            "started_at": started_at.isoformat() if started_at else None,
            "ended_at": ended_at.isoformat() if ended_at else None,
            "duration_seconds": duration_seconds,
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
            **analysis,
        }
        
        # Add enhanced metadata from webhook if available
        if webhook_data:
            metadata = webhook_data.get("data", {}).get("metadata", {})
            webhook_analysis = webhook_data.get("data", {}).get("analysis", {})
            
            # Store raw webhook data for debugging/audit
            result_row["raw_analysis"] = {
                "webhook_metadata": metadata,
                "webhook_analysis": webhook_analysis,
                "elevenlabs_cost": metadata.get("cost", 0),
                "call_successful": webhook_analysis.get("call_successful", "unknown")
            }
        
        # 5) Store results in database
        insert_res = storage.supabase_store.supabase.table("interview_results").insert(result_row).execute()
        
        if insert_res.data:
            logger.info(f"✅ Interview results stored successfully for session {session_id}")
            logger.info(f"📊 Analysis summary - Overall: {analysis.get('overall_score', 0)}%, Domain: {analysis.get('domain_score', 0)}%, Communication: {analysis.get('communication_score', 0)}%")
            
            # 6) Update session status to completed
            storage.supabase_store.supabase.table("interview_sessions").update({
                "status": "completed",
                "updated_at": datetime.utcnow().isoformat()
            }).eq("id", session_id).execute()
            
            logger.info(f"✅ Session {session_id} marked as completed")
            
        else:
            logger.error(f"❌ Failed to store interview results for session {session_id}")
            
    except Exception as e:
        logger.error(f"❌ Error in automatic interview analysis for session {session_id}: {str(e)}")
        logger.error(f"Full traceback: {traceback.format_exc()}")

# Enhanced HMAC verification function for latest ElevenLabs format
def verify_webhook_signature(payload: str, signature: str, secret: str) -> bool:
    """Verify ElevenLabs webhook signature using HMAC (Latest Format)"""
    try:
        # Latest ElevenLabs format includes timestamp validation
        # Signature format: "t=timestamp,v0=signature" or just "v0=signature"
        
        timestamp = None
        signature_hash = signature
        
        # Parse timestamp and signature if using latest format
        if ',' in signature:
            parts = signature.split(',')
            for part in parts:
                if part.startswith('t='):
                    timestamp = part[2:]
                elif part.startswith('v0='):
                    signature_hash = part[3:]  # Remove 'v0=' prefix
        elif signature.startswith('v0='):
            signature_hash = signature[3:]  # Remove 'v0=' prefix
        elif signature.startswith('sha256='):
            signature_hash = signature[7:]  # Remove 'sha256=' prefix
        
        # Validate timestamp (30-minute tolerance)
        if timestamp:
            try:
                timestamp_int = int(timestamp)
                current_time = int(time.time())
                tolerance = 30 * 60  # 30 minutes
                
                if current_time - timestamp_int > tolerance:
                    logger.warning(f"⚠️ Webhook timestamp too old: {timestamp_int} vs {current_time}")
                    return False
                
                # Create payload with timestamp for verification
                payload_to_sign = f"{timestamp}.{payload}"
            except ValueError:
                logger.warning(f"⚠️ Invalid timestamp in webhook signature: {timestamp}")
                payload_to_sign = payload
        else:
            payload_to_sign = payload
        
        # Compute expected signature
        expected_signature = hmac.new(
            secret.encode('utf-8'),
            payload_to_sign.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()
        
        # Compare signatures
        is_valid = hmac.compare_digest(expected_signature, signature_hash)
        
        if is_valid:
            logger.info("✅ Webhook signature verification successful")
        else:
            logger.warning(f"⚠️ Signature mismatch. Expected: {expected_signature[:8]}..., Got: {signature_hash[:8]}...")
        
        return is_valid
        
    except Exception as e:
        logger.error(f"❌ Error verifying webhook signature: {str(e)}")
        return False

@app.post("/api/test-name-extraction")
async def test_candidate_name_extraction(payload: dict):
    """Test endpoint to verify candidate name extraction using LLM"""
    try:
        resume_text = payload.get("resume_text", "")
        filename = payload.get("filename", "test_resume.pdf")
        
        if not resume_text:
            return {"status": "error", "error": "resume_text required"}
        
        # Test name extraction
        openai_client = AzureOpenAIClient()
        name_extractor = CandidateNameExtractor(openai_client)
        
        # Extract name using LLM
        extracted_name = await name_extractor.extract_candidate_name(resume_text, filename)
        
        # Also test filename fallback
        filename_fallback = name_extractor._extract_name_from_filename(filename)
        
        return {
            "status": "success",
            "data": {
                "filename": filename,
                "resume_text_preview": resume_text[:200] + "..." if len(resume_text) > 200 else resume_text,
                "extracted_name_llm": extracted_name,
                "filename_fallback": filename_fallback,
                "resume_text_length": len(resume_text)
            },
            "message": "Name extraction completed successfully"
        }
        
    except Exception as e:
        logger.error(f"Error testing name extraction: {str(e)}")
        return {"status": "error", "error": str(e)}

@app.get("/api/test-delete/{job_id}")
async def test_delete_endpoint(job_id: str):
    """Test endpoint to verify delete functionality"""
    try:
        if not storage.supabase_store.supabase:
            return {"status": "error", "error": "Supabase not available"}
        
        # Check if job exists
        check_result = storage.supabase_store.supabase.table("job_posts").select("id, job_role").eq("id", job_id).execute()
        
        if not check_result.data:
            return {"status": "error", "error": f"Job {job_id} not found in database", "exists": False}
        
        return {
            "status": "success",
            "message": f"Job {job_id} exists in database",
            "exists": True,
            "job_data": check_result.data[0]
        }
        
    except Exception as e:
        return {"status": "error", "error": str(e)}

@app.get("/api/elevenlabs/signed-url")
async def get_elevenlabs_signed_url(agentId: str = Query(...)):
    """Get a signed URL for ElevenLabs conversational AI"""
    logger.info(f"🔗 Received request for signed URL with agentId: {agentId}")
    try:
        # Validate agentId parameter
        if not agentId or not agentId.strip():
            logger.error(f"❌ Invalid agentId parameter: '{agentId}'")
            raise HTTPException(status_code=400, detail="agentId parameter is required and cannot be empty")
        
        # ElevenLabs API key (hardcoded)
        elevenlabs_api_key = "sk_99b0a60fc75de64325fe89d89b145782f08054d7263064ac"
        
        # Make request to ElevenLabs API to get signed URL
        headers = {
            "xi-api-key": elevenlabs_api_key,
            "Content-Type": "application/json"
        }
        
        url = f"https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id={agentId}"
        
        async with httpx.AsyncClient() as client:
            response = await client.get(url, headers=headers)
            
            if response.status_code != 200:
                logger.error(f"ElevenLabs API error: {response.status_code} - {response.text}")
                return {
                    "status": "error",
                    "error": f"Failed to get signed URL: {response.status_code}"
                }
            
            data = response.json()
            logger.info(f"✅ Generated signed URL for agent {agentId}")
            
            return {
                "status": "success",
                "signed_url": data.get("signed_url")
            }
            
    except Exception as e:
        logger.error(f"Error getting ElevenLabs signed URL: {str(e)}")
        return {
            "status": "error",
            "error": str(e)
        }

# Main app runner
if __name__ == "__main__":
    # Validate environment variables
    if not Config.validate():
        print("\n💡 To fix this, create a .env file in the project root with:")
        print("   AZURE_OPENAI_API_KEY=your_api_key_here")
        print("   AZURE_OPENAI_ENDPOINT=your_endpoint_here")
        print("   AZURE_OPENAI_DEPLOYMENT=your_deployment_name (optional, defaults to gpt-4)")
        print("   LOG_LEVEL=INFO (optional)")
        exit(1)
    
    uvicorn.run(
        "resumematching:app",
        host="0.0.0.0",
        port=8000,
        workers=1,  # Single worker since we're using in-memory storage
        log_config={
            "version": 1,
            "disable_existing_loggers": False,
            "formatters": {
                "default": {
                    "format": "%(asctime)s - %(name)s - %(levelname)s - %(message)s",
                },
            },
            "handlers": {
                "default": {
                    "formatter": "default",
                    "class": "logging.StreamHandler",
                    "stream": "ext://sys.stdout",
                },
            },
            "root": {
                "level": Config.LOG_LEVEL,
                "handlers": ["default"],
            },
        }
    )