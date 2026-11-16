from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

class ChatMessage(BaseModel):
    role: str = Field(..., description="'user' or 'assistant'")
    content: str = Field(..., description="Message text")

class ChatQueryRequest(BaseModel):
    tender_id: str = Field(..., description="Tender ID (e.g. GEM/2026/B/8212436)")
    query: str = Field(..., description="User question about the tender")
    history: Optional[List[ChatMessage]] = Field(default_factory=list, description="Recent conversation turns")

class ChatQueryResponse(BaseModel):
    tender_id: str
    query: str
    answer: str
    sources: List[str] = Field(default_factory=list)
    confidence: str = "High"
    suggested_followups: List[str] = Field(default_factory=list)

class SuggestedQuestionsResponse(BaseModel):
    tender_id: str
    questions: List[str]
