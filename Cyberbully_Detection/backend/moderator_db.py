# backend/moderator_db.py

from datetime import datetime
from sqlalchemy.orm import Session
from backend.models import ModeratorAction as ModeratorActionModel

def save_moderator_action(
    comment_id: str,
    text: str,
    action: str,
    db: Session
):
    """
    Persist a moderator's approve/reject action into the database.
    """
    db_action = ModeratorActionModel(
        comment_id=comment_id,
        text=text,
        action=action,
        timestamp=datetime.utcnow()
    )
    db.add(db_action)
    db.commit()
    db.refresh(db_action)
    return db_action



