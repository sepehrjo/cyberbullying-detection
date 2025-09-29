# backend/database.py

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base


# Database URL

DATABASE_URL = "postgresql://sepehrchn:25051378Sc%40@localhost:5432/cyberbullydb"


# Engine & Session factory

engine = create_engine(DATABASE_URL, echo=True)
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

# Base class for all ORM models
Base = declarative_base()
