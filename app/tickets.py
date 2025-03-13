import logging
import os
import base64
from sqlalchemy import select
from app.database import engine
from app.models import tickets_table
from datetime import datetime
from app.config import SEAT_IMAGE_FOLDER

# ✅ 로깅 설정 (로그 포맷과 레벨 설정)
logging.basicConfig(
    level=logging.INFO,  # 로그 레벨 (INFO 이상만 출력)
    format="%(asctime)s - %(levelname)s - %(message)s",  # 로그 포맷 설정
    datefmt="%Y-%m-%d %H:%M:%S"
)

# ✅ 티켓 데이터를 캐싱할 전역 변수
ticket_cache = []

def serialize_ticket(ticket):
    """
    JSON 직렬화를 위해 datetime을 문자열로 변환하는 함수
    """
    return {
        k: (v.isoformat() if isinstance(v, datetime) else v)  # ✅ datetime → 문자열 변환
        for k, v in ticket.items()
    }

def encode_image_to_base64(image_path):
    """
    이미지 파일을 Base64로 변환
    """
    try:
        with open(image_path, "rb") as image_file:
            return base64.b64encode(image_file.read()).decode("utf-8")
    except Exception as e:
        logging.error("❌ Error encoding image: %s", e)
        return None

def load_ticket_cache():
    """
    DB에서 모든 티켓 정보를 불러와 캐시에 저장 (이미지 URL 방식)
    """
    global ticket_cache
    try:
        with engine.connect() as connection:
            query = select(tickets_table)
            result = connection.execute(query)
            tickets = result.fetchall()

            ticket_cache = []
            for row in tickets:
                seat_image_url = f"http://localhost:8000/seat-image/{row.seat_image_name}" if row.seat_image_name else None

                ticket_cache.append({
                    "reservation_number": row.reservation_number,
                    "purchase_source": row.purchase_source,
                    "buyer": row.buyer,
                    "purchase_date": row.purchase_date,
                    "payment_amount": row.payment_amount,
                    "seat_detail": row.seat_detail,
                    "seat_image_name": row.seat_image_name,
                    "seat_image_url": seat_image_url  # ✅ Base64 대신 URL 사용
                })

            logging.info("✅ Successfully loaded %d tickets from the database.", len(ticket_cache))
    except Exception as e:
        logging.error("❌ Error loading ticket cache from the database: %s", e)

def get_cached_tickets():
    """
    캐싱된 티켓 정보를 반환 (JSON 직렬화 가능하게 변환)
    """
    return [serialize_ticket(ticket) for ticket in ticket_cache]  # ✅ datetime 변환 후 반환
