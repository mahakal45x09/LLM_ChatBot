import os
import sys
import uuid
import asyncio
from pathlib import Path
from typing import AsyncGenerator, List, Dict, Any, Optional, Tuple

# Ensure backend directory is in sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent))

try:
    from config import settings
except ImportError:
    from backend.config import settings

# Safe imports for LLM SDKs
try:
    import google.generativeai as genai
    from google.api_core.exceptions import (
        ResourceExhausted,
        Unauthenticated,
        PermissionDenied,
        NotFound,
        GoogleAPIError,
    )
except ImportError:
    genai = None
    ResourceExhausted = Exception
    Unauthenticated = Exception
    PermissionDenied = Exception
    NotFound = Exception
    GoogleAPIError = Exception

try:
    from openai import AsyncOpenAI, APIStatusError, APITimeoutError
except ImportError:
    AsyncOpenAI = None
    APIStatusError = Exception
    APITimeoutError = Exception


class ConversationSessionStore:
    """In-memory session manager maintaining multi-turn history per conversation_id."""

    def __init__(self, max_sessions: int = 200):
        self._sessions: Dict[str, List[Dict[str, str]]] = {}
        self.max_sessions = max_sessions

    def get_or_create(self, conversation_id: Optional[str] = None) -> Tuple[str, List[Dict[str, str]]]:
        if not conversation_id or conversation_id not in self._sessions:
            cid = conversation_id or str(uuid.uuid4())
            self._sessions[cid] = []
            # Evict oldest session if store exceeds capacity
            if len(self._sessions) > self.max_sessions:
                oldest = next(iter(self._sessions))
                del self._sessions[oldest]
            return cid, self._sessions[cid]
        return conversation_id, self._sessions[conversation_id]

    def add_message(self, conversation_id: str, role: str, content: str):
        if conversation_id not in self._sessions:
            self._sessions[conversation_id] = []
        self._sessions[conversation_id].append({"role": role, "content": content})

    def get_history(self, conversation_id: str) -> List[Dict[str, str]]:
        return self._sessions.get(conversation_id, [])

    def clear(self, conversation_id: str):
        if conversation_id in self._sessions:
            self._sessions[conversation_id] = []


class ContextWindowManager:
    """Manages conversational context: applies sliding-window truncation to preserve token limits."""

    def __init__(self, max_messages: int = 10, system_prompt: str = ""):
        self.max_messages = max_messages
        self.system_prompt = system_prompt

    def truncate_history(self, messages: List[Dict[str, str]]) -> List[Dict[str, str]]:
        """
        Preserves the last N messages. If older messages are truncated,
        prepends a brief continuity note so the model understands conversation was truncated.
        """
        # Filter out any raw client-sent system messages to ensure persona consistency
        chat_messages = [m for m in messages if m.get("role") != "system"]

        if len(chat_messages) <= self.max_messages:
            return chat_messages

        pruned_count = len(chat_messages) - self.max_messages
        recent_messages = chat_messages[-self.max_messages:]

        continuity_note = {
            "role": "user",
            "content": f"[Note: {pruned_count} earlier message(s) were truncated to maintain context window. Please continue with recent context.]"
        }
        ack_note = {
            "role": "assistant",
            "content": "Understood. I will maintain context from our recent exchanges."
        }

        return [continuity_note, ack_note] + recent_messages


class ChatbotService:
    def __init__(self):
        self.provider = settings.LLM_PROVIDER.lower()
        self.sessions = ConversationSessionStore()
        self.context_manager = ContextWindowManager(
            max_messages=settings.MAX_HISTORY_MESSAGES,
            system_prompt=settings.SYSTEM_PROMPT,
        )
        self._init_provider()

    def _init_provider(self):
        if self.provider == "gemini":
            if not settings.GEMINI_API_KEY:
                print("Warning: GEMINI_API_KEY is not configured in backend/.env.")
            elif genai:
                genai.configure(api_key=settings.GEMINI_API_KEY)
        elif self.provider == "openai":
            if not settings.OPENAI_API_KEY:
                print("Warning: OPENAI_API_KEY is not configured in backend/.env.")
            elif AsyncOpenAI:
                self.openai_client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        else:
            raise ValueError(f"Unsupported LLM provider: {self.provider}")

    async def stream_chat(
        self,
        messages: List[Dict[str, str]],
        conversation_id: Optional[str] = None,
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Streams response chunks from the configured LLM provider.
        Returns dictionaries: {"content": str, "conversation_id": str} or {"error": str}.
        """
        # 1. Manage session & multi-turn history
        cid, session_history = self.sessions.get_or_create(conversation_id)

        # Sync messages: if client passed a message list, use it; otherwise use session
        if messages:
            # Sync session with latest client message
            active_messages = messages
        else:
            active_messages = session_history

        # 2. Context Window Management: apply sliding-window truncation
        truncated_messages = self.context_manager.truncate_history(active_messages)

        full_assistant_reply = []

        try:
            if self.provider == "gemini":
                async for chunk in self._stream_gemini_with_timeout(truncated_messages):
                    full_assistant_reply.append(chunk)
                    yield {"content": chunk, "conversation_id": cid}
            elif self.provider == "openai":
                async for chunk in self._stream_openai_with_timeout(truncated_messages):
                    full_assistant_reply.append(chunk)
                    yield {"content": chunk, "conversation_id": cid}

            # Update session store with full exchange
            if active_messages:
                last_user_msg = active_messages[-1]
                if last_user_msg.get("role") == "user":
                    self.sessions.add_message(cid, "user", last_user_msg["content"])
                self.sessions.add_message(cid, "assistant", "".join(full_assistant_reply))

        except asyncio.TimeoutError:
            yield {
                "error": f"The request timed out after {settings.REQUEST_TIMEOUT_SECONDS} seconds. Please try again.",
                "conversation_id": cid,
            }
        except ResourceExhausted:
            yield {
                "error": "Gemini API rate limit reached (Free Tier quota exceeded). Please wait a few seconds before trying again.",
                "conversation_id": cid,
            }
        except (Unauthenticated, PermissionDenied):
            yield {
                "error": "Authentication failed. Please check your GEMINI_API_KEY in backend/.env.",
                "conversation_id": cid,
            }
        except NotFound as e:
            yield {
                "error": f"Model '{settings.GEMINI_MODEL}' not found or unavailable. Details: {str(e)}",
                "conversation_id": cid,
            }
        except Exception as e:
            yield {
                "error": f"Error communicating with {self.provider.upper()}: {str(e)}",
                "conversation_id": cid,
            }

    async def _stream_gemini_with_timeout(
        self, messages: List[Dict[str, str]]
    ) -> AsyncGenerator[str, None]:
        if not settings.GEMINI_API_KEY:
            yield "Configuration Error: GEMINI_API_KEY is missing. Please add it to backend/.env."
            return

        if not genai:
            yield "Server Error: google-generativeai package is not installed."
            return

        # Initialize model with persona system instructions
        model = genai.GenerativeModel(
            model_name=settings.GEMINI_MODEL,
            system_instruction=settings.SYSTEM_PROMPT,
            generation_config=genai.types.GenerationConfig(
                max_output_tokens=settings.MAX_TOKENS,
                temperature=settings.TEMPERATURE,
            ),
        )

        # Convert to Gemini format
        contents = []
        for msg in messages:
            role = "user" if msg["role"] == "user" else "model"
            contents.append({"role": role, "parts": [msg["content"]]})

        # Apply timeout to response generation
        async def _run_stream():
            return await model.generate_content_async(contents, stream=True)

        response = await asyncio.wait_for(_run_stream(), timeout=settings.REQUEST_TIMEOUT_SECONDS)
        async for chunk in response:
            if chunk.text:
                yield chunk.text

    async def _stream_openai_with_timeout(
        self, messages: List[Dict[str, str]]
    ) -> AsyncGenerator[str, None]:
        if not settings.OPENAI_API_KEY:
            yield "Configuration Error: OPENAI_API_KEY is missing. Please add it to backend/.env."
            return

        if not AsyncOpenAI or not hasattr(self, "openai_client"):
            yield "Server Error: openai package is not installed or client not initialized."
            return

        # Inject system prompt into OpenAI message payload
        formatted_messages = [
            {"role": "system", "content": settings.SYSTEM_PROMPT}
        ] + [
            {"role": m["role"], "content": m["content"]}
            for m in messages
        ]

        async def _run_openai():
            return await self.openai_client.chat.completions.create(
                model=settings.OPENAI_MODEL,
                messages=formatted_messages,
                temperature=settings.TEMPERATURE,
                max_tokens=settings.MAX_TOKENS,
                stream=True,
            )

        response = await asyncio.wait_for(_run_openai(), timeout=settings.REQUEST_TIMEOUT_SECONDS)
        async for chunk in response:
            delta = chunk.choices[0].delta
            if delta and delta.content:
                yield delta.content


chatbot_service = ChatbotService()
