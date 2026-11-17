from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from backend.models.tender import Tender
from chatbot.rag_engine import LocalRAGEngine
from chatbot.schemas import ChatQueryResponse, SuggestedQuestionsResponse

class ChatbotService:
    @staticmethod
    def get_tender_data(db: Session, tender_id: str) -> Optional[Dict[str, Any]]:
        # Match by tender_id or reference
        tender = db.query(Tender).filter(
            (Tender.tender_id == tender_id) | (Tender.reference == tender_id)
        ).first()

        if not tender and tender_id.isdigit():
            tender = db.query(Tender).filter(Tender.id == int(tender_id)).first()

        if not tender:
            return None

        return {
            "id": tender.id,
            "tender_id": tender.tender_id,
            "reference": tender.reference,
            "title": tender.title,
            "portal": tender.portal,
            "organisation": tender.organisation,
            "published_date": tender.published_date,
            "closing_date": tender.closing_date,
            "opening_date": tender.opening_date,
            "url": tender.url,
            "doc_url": tender.doc_url,
            "estimated_value": tender.estimated_value,
            "emd_amount": tender.emd_amount,
            "emd_exemption": tender.emd_exemption,
            "epbg_required": tender.epbg_required,
            "turnover_required": tender.turnover_required,
            "bidder_turnover": tender.bidder_turnover,
            "oem_turnover": tender.oem_turnover,
            "experience_required": tender.experience_required,
            "experience_years": tender.experience_years,
            "mse_relaxation": tender.mse_relaxation,
            "startup_relaxation": tender.startup_relaxation,
            "scope_summary": tender.scope_summary,
            "extracted_pdf_text": tender.extracted_pdf_text or "",
            "eligibility_assessment": tender.eligibility_assessment,
            "si_partner_route": tender.si_partner_route,
            "matched_keywords": tender.matched_keywords,
            "assessment_notes": tender.assessment_notes,
            "fit_score": tender.fit_score or 0,
            "status": tender.status,
            "priority": tender.priority,
            "user_notes": tender.user_notes or ""
        }

    @classmethod
    def process_query(cls, db: Session, tender_id: str, query: str) -> ChatQueryResponse:
        tender_data = cls.get_tender_data(db, tender_id)
        if not tender_data:
            return ChatQueryResponse(
                tender_id=tender_id,
                query=query,
                answer=f"⚠️ Tender `{tender_id}` could not be found in the database. Please verify the Tender ID.",
                sources=["Database Search"],
                confidence="Low",
                suggested_followups=[]
            )

        res = LocalRAGEngine.answer_query(tender_data, query)
        return ChatQueryResponse(
            tender_id=tender_data["tender_id"],
            query=query,
            answer=res["answer"],
            sources=res.get("sources", []),
            confidence=res.get("confidence", "High"),
            suggested_followups=res.get("suggested_followups", [])
        )

    @classmethod
    def get_suggested_questions(cls, db: Session, tender_id: str) -> SuggestedQuestionsResponse:
        tender_data = cls.get_tender_data(db, tender_id)
        if not tender_data:
            return SuggestedQuestionsResponse(
                tender_id=tender_id,
                questions=[
                    "What are the EMD requirements?",
                    "What is the required turnover?",
                    "What is the equipment scope / BOQ?"
                ]
            )

        questions = [
            f"What is the EMD amount & bank guarantee for this tender?",
            f"What is the required annual turnover?",
            f"What equipment is in the BOQ scope?",
            f"Are MSE or Startups exempt in this bid?",
            f"What are the compliance and testing certifications required?"
        ]
        return SuggestedQuestionsResponse(
            tender_id=tender_data["tender_id"],
            questions=questions
        )
