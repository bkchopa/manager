from sqlalchemy import create_engine, MetaData
from sqlalchemy.orm import sessionmaker
from .config import DATABASE_URL
import logging

# SQLAlchemy 엔진 생성
engine = create_engine(DATABASE_URL)

# DB 세션 생성
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 메타데이터 객체 생성
metadata = MetaData()

def check_db_connection():
    """
    DB 연결 확인 (서버 시작 시 실행)
    """
    try:
        with engine.connect() as connection:
            logging.info("✅ Successfully connected to the database!")
    except Exception as e:
        logging.error("❌ Database connection failed: %s", e)
