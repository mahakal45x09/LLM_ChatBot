import sys
from pathlib import Path

# Ensure both backend directory and root directory are in sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import json
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Literal, Optional

try:
    from config import settings
    from chatbot import chatbot_service
except ImportError:
    from backend.config import settings
    from backend.chatbot import chatbot_service

app = FastAPI(
    title="LLM Chatbot API",
    description="FastAPI Backend for LLM Chatbot with multi-turn history, context management, and SSE streaming",
    version="1.1.0",
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class Message(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str


class ChatRequest(BaseModel):
    messages: List[Message]
    conversation_id: Optional[str] = None


@app.get("/")
async def root():
    return {
        "status": "online",
        "bot_name": settings.BOT_NAME,
        "provider": settings.LLM_PROVIDER,
        "model": (
            settings.GEMINI_MODEL
            if settings.LLM_PROVIDER == "gemini"
            else settings.OPENAI_MODEL
        ),
        "context_window_max_messages": settings.MAX_HISTORY_MESSAGES,
        "timeout_seconds": settings.REQUEST_TIMEOUT_SECONDS,
    }


@app.get("/api/conversations/{conversation_id}")
async def get_conversation(conversation_id: str):
    history = chatbot_service.sessions.get_history(conversation_id)
    return {"conversation_id": conversation_id, "messages": history}


@app.delete("/api/conversations/{conversation_id}")
async def clear_conversation(conversation_id: str):
    chatbot_service.sessions.clear(conversation_id)
    return {"status": "cleared", "conversation_id": conversation_id}


@app.post("/api/chat")
async def chat_endpoint(request: ChatRequest):
    if not request.messages:
        raise HTTPException(status_code=400, detail="Messages list cannot be empty.")

    messages_data = [m.model_dump() for m in request.messages]

    async def event_generator():
        try:
            async for chunk in chatbot_service.stream_chat(
                messages=messages_data,
                conversation_id=request.conversation_id,
            ):
                # Send Server-Sent Events (SSE) format
                data = json.dumps(chunk)
                yield f"data: {data}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            err_data = json.dumps({
                "error": f"Internal server error: {str(e)}",
                "conversation_id": request.conversation_id,
            })
            yield f"data: {err_data}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Content-Type": "text/event-stream",
        },
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=settings.HOST, port=settings.PORT, reload=True)
