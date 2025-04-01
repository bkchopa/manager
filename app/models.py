from sqlalchemy import Table, Column, Integer, String, DateTime, ForeignKeyConstraint, MetaData
from .database import engine, metadata

# 최신 스키마를 반영합니다.
metadata.clear()  # 기존의 메타데이터를 비웁니다.
metadata.reflect(bind=engine)

# ticket 테이블은 자동 로드 (DB에 존재하는 모든 컬럼 포함)
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
    ForeignKeyConstraint(["reservation_number"], ["ticket.reservation_number"]),
    extend_existing=True  # 기존 정의가 있으면 확장
)

ticket_sale_done = Table(
    "ticket_sale_done", metadata,
    Column("prodnum", String(50), nullable=False),
    Column("order_num", String(50), nullable=False, primary_key=True),
    Column("order_date", DateTime, nullable=False),
    Column("buyer_name", String(50), nullable=False),
    Column("buyer_contact", String(50), nullable=False),
    Column("product_category", String(255), nullable=False),
    Column("product_description", String, nullable=False),
    Column("product_datetime", DateTime, nullable=False),
    Column("unit_price", Integer, nullable=False),
    Column("deal_status", String(50), nullable=False),
    Column("remark", String, nullable=True),
    extend_existing=True
)

ticket_canceled = Table(
    "ticket_canceled", metadata,
    Column("reservation_number", String(50), nullable=False),
    Column("purchase_source", String(50)),
    Column("buyer", String(50)),
    Column("purchase_date", DateTime),
    Column("payment_amount", Integer),
    Column("payment_method", String(50)),
    Column("card_company", String(50)),
    Column("card_number", String(50)),
    Column("card_approval_number", String(50)),
    Column("product_use_date", DateTime),
    Column("product_name", String(255)),
    Column("purchase_quantity", Integer),
    Column("remaining_quantity", Integer),
    Column("seat_detail", String(255)),
    Column("seat_image_name", String(255)),
    Column("cancel_fee", Integer),
    extend_existing=True
)
metadata.create_all(bind=engine)