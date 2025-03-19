import os

# MSSQL 접속 정보
DATABASE_URL = "mssql+pyodbc://@DESKTOP-BU82OCN/ticket?driver=ODBC+Driver+17+for+SQL+Server&trusted_connection=yes"
#DATABASE_URL = "mssql+pyodbc://gamedb:[^fgU1i&@175.207.4.155/cso_steam_test?driver=ODBC+Driver+17+for+SQL+Server"

# 서버 URL 추가 (예: 개발용)
SERVER_URL = "http://59.13.119.90:8000"


# 좌석 이미지 저장 폴더 설정
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SEAT_IMAGE_FOLDER = os.path.join(PROJECT_ROOT, "seat_images")
os.makedirs(SEAT_IMAGE_FOLDER, exist_ok=True)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UPLOAD_DIR = os.path.join(BASE_DIR, "uploaded_images")
os.makedirs(UPLOAD_DIR, exist_ok=True)