import sys
from pathlib import Path
from loguru import logger

LOG_DIR = Path(__file__).parent.parent / "logs"
LOG_DIR.mkdir(exist_ok=True)

logger.remove()

# Console — colorato, leggibile
logger.add(
    sys.stderr,
    format="<green>{time:HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan> - <level>{message}</level>",
    level="INFO",
    colorize=True,
)

# File — rotazione giornaliera, retention 7 giorni
logger.add(
    LOG_DIR / "backend.log",
    format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {name} | {message}",
    level="DEBUG",
    rotation="00:00",
    retention="7 days",
    encoding="utf-8",
)

__all__ = ["logger"]
