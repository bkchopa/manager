from sqlalchemy import Table, Column, Integer, String, DateTime, ForeignKeyConstraint, MetaData
from .database import engine, metadata

# "ticket" 테이블을 자동 로드 (MSSQL 테이블 구조 기반)
tickets_table = Table("ticket", metadata, autoload_with=engine)

ticket_sale_info = Table(
    "ticket_sale_info", metadata,
    Column("reservation_number", String(50), nullable=False),
    Column("prodnum", String(50), nullable=False, primary_key=True),
    Column("ticket_grade", String(50), nullable=False),
    Column("ticket_floor", String(100), nullable=False),
    Column("ticket_area", String(50), nullable=False),
    Column("product_category", String(255), nullable=False),
    Column("product_datetime", DateTime, nullable=False),
    Column("product_description", String, nullable=False),
    Column("price", Integer, nullable=False),
    Column("quantity", Integer, nullable=False),
    ForeignKeyConstraint(["reservation_number"], ["ticket.reservation_number"])
)