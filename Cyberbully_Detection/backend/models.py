# define SQL tables for database table
# backend/models.py

from sqlalchemy import Column, Integer, String, DateTime, Enum
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime
import enum

Base = declarative_base()

class Status(enum.Enum):
    """
    Enum for comment status (not currently used by API directly,
    but available for future extensions).
    """
    pending  = "pending"
    approved = "approved"
    rejected = "rejected"

class User(Base):
    """
    Represents a moderator user account.
    """
    __tablename__ = "users"

    id      = Column(Integer, primary_key=True, index=True)
    email   = Column(String, unique=True, nullable=False, index=True)
    # Column name 'hashed' stores the bcrypt hash of their password
    hashed  = Column(String, nullable=False)
    created = Column(DateTime, default=datetime.utcnow)

class ModeratorAction(Base):
    """
    Records each moderation action (approve/reject) taken
    by a moderator on a flagged comment.
    """
    __tablename__ = "moderator_actions"

    id         = Column(Integer, primary_key=True, index=True)
    comment_id = Column(String, nullable=False)
    text       = Column(String, nullable=False)
    action     = Column(String, nullable=False)  # "approved" or "rejected"
    timestamp  = Column(DateTime, default=datetime.utcnow)

