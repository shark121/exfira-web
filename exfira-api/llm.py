"""
LiteLLM wrapper — sends redacted messages to GPT-4o-mini.
"""

import os
import litellm


SYSTEM_PROMPT = (
    "You are a helpful AI assistant. "
    "Some parts of the user's message may contain placeholder tokens like <PERSON>, "
    "<EMAIL_ADDRESS_1>, etc. These represent real values that have been redacted for privacy. "
    "Treat them as if they were the actual values. "
    "Refer to them naturally in your response using the same tokens."
)


async def chat_with_llm(messages: list[dict]) -> str:
    all_messages = [{"role": "system", "content": SYSTEM_PROMPT}] + messages

    response = await litellm.acompletion(
        model=os.getenv("LLM_MODEL", "gpt-4o-mini"),
        messages=all_messages,
        api_key=os.getenv("OPENAI_API_KEY"),
        temperature=0.7,
        max_tokens=1024,
    )

    return response.choices[0].message.content or ""
