from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.core.db import get_db
from chatbot.schemas import ChatQueryRequest, ChatQueryResponse, SuggestedQuestionsResponse
from chatbot.service import ChatbotService

router = APIRouter(prefix="/chatbot", tags=["Tender Chatbot"])

@router.post("/query", response_model=ChatQueryResponse)
def query_tender_chatbot(
    payload: ChatQueryRequest,
    db: Session = Depends(get_db)
):
    """
    RAG-powered query endpoint grounded strictly on the specified tender's documents.
    """
    if not payload.query or not payload.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")

    return ChatbotService.process_query(
        db=db,
        tender_id=payload.tender_id,
        query=payload.query
    )

@router.get("/suggested/{tender_id}", response_model=SuggestedQuestionsResponse)
def get_suggested_questions(
    tender_id: str,
    db: Session = Depends(get_db)
):
    """
    Returns quick-query prompt chips tailored for the tender.
    """
    return ChatbotService.get_suggested_questions(db=db, tender_id=tender_id)
