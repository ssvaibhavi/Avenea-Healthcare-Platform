"""Password hashing with bcrypt (an established, maintained library).

Only hashes are ever stored. There is no login route and no seeded account.
"""

import bcrypt

MIN_PASSWORD_LENGTH = 12
MAX_PASSWORD_BYTES = 72  # bcrypt's input limit; reject rather than silently truncate
DEFAULT_ROUNDS = 12


def hash_password(password: str, *, rounds: int = DEFAULT_ROUNDS) -> str:
    if len(password) < MIN_PASSWORD_LENGTH:
        raise ValueError(f"password must be at least {MIN_PASSWORD_LENGTH} characters")
    raw = password.encode()
    if len(raw) > MAX_PASSWORD_BYTES:
        raise ValueError(f"password must be at most {MAX_PASSWORD_BYTES} bytes")
    if rounds < 10:
        raise ValueError("bcrypt rounds must be >= 10")
    return bcrypt.hashpw(raw, bcrypt.gensalt(rounds=rounds)).decode()


def verify_password(password: str, password_hash: str) -> bool:
    raw = password.encode()
    if len(raw) > MAX_PASSWORD_BYTES:
        return False
    try:
        return bcrypt.checkpw(raw, password_hash.encode())
    except ValueError:  # malformed hash
        return False
