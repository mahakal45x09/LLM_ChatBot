import os
from pathlib import Path
from pydantic_settings import BaseSettings
from typing import Optional

ENV_PATH = Path(__file__).resolve().parent / ".env"

DEFAULT_SYSTEM_PROMPT = (
    "You are Nova, an expert AI Software Architect and technical mentor. "
    "Personality & Style Guidelines:\n"
    "- You have deep expertise across software design, algorithms, backend/frontend engineering, and DevOps.\n"
    "- You communicate with clarity, structure, and technical precision, using clear code blocks where appropriate.\n"
    "- You are encouraging, thoughtful, and pragmatic.\n"
    "- You actively track conversational context, recalling and referencing decisions or topics discussed in earlier messages.\n"
    "- When solving problems, you briefly explain the architectural 'why' behind your recommendation."
)


class Settings(BaseSettings):
    # Bot Persona
    BOT_NAME: str = "Nova"
    SYSTEM_PROMPT: str = DEFAULT_SYSTEM_PROMPT

    # Provider: "gemini" or "openai"
    LLM_PROVIDER: str = "gemini"
    
    # API Keys
    GEMINI_API_KEY: Optional[str] = None
    OPENAI_API_KEY: Optional[str] = None
    
    # Model Names
    GEMINI_MODEL: str = "gemini-flash-lite-latest"
    OPENAI_MODEL: str = "gpt-4o-mini"
    
    # Context window & generation parameters
    MAX_TOKENS: int = 2048
    TEMPERATURE: float = 0.7
    MAX_HISTORY_MESSAGES: int = 10  # Context window: keep last N messages (e.g. 5 full turns)
    REQUEST_TIMEOUT_SECONDS: int = 45  # Timeout for API calls to prevent hanging
    
    # Server config
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]

    class Config:
        env_file = str(ENV_PATH)
        env_file_encoding = "utf-8"


settings = Settings()
