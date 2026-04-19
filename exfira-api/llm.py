import os
import logging
import litellm

logger = logging.getLogger("exfira")

SYSTEM_PROMPT = (
    "You are a helpful AI assistant. "
    "Some parts of the user's message may contain placeholder tokens like <PERSON>, "
    "<EMAIL_ADDRESS_1>, etc. These represent real values that have been redacted for privacy. "
    "Treat them as if they were the actual values. "
    "Refer to them naturally in your response using the same tokens."
)


async def chat_with_llm(messages: list[dict]) -> str:
    model = os.getenv("LLM_MODEL", "gpt-4o-mini")
    all_messages = [{"role": "system", "content": SYSTEM_PROMPT}] + messages

    try:
        response = await litellm.acompletion(
            model=model,
            messages=all_messages,
            api_key=os.getenv("OPENAI_API_KEY"),
            temperature=0.7,
            max_tokens=1024,
        )
    except Exception as e:
        logger.error("LLM call failed: %s", e)
        raise

    content = response.choices[0].message.content or ""

    usage = getattr(response, "usage", None)
    if usage:
        logger.info("   Tokens     : prompt=%d  completion=%d  total=%d",
                    usage.prompt_tokens, usage.completion_tokens, usage.total_tokens)

    return content
