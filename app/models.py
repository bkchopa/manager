from sqlalchemy import Table
from .database import engine, metadata

# "ticket" 테이블을 자동 로드 (MSSQL 테이블 구조 기반)
tickets_table = Table("ticket", metadata, autoload_with=engine)
