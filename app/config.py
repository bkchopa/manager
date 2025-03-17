import os

# MSSQL 접속 정보
DATABASE_URL = "mssql+pyodbc://@DESKTOP-BU82OCN/ticket?driver=ODBC+Driver+17+for+SQL+Server&trusted_connection=yes"


# 좌석 이미지 저장 폴더 설정
SEAT_IMAGE_FOLDER = os.path.join(os.getcwd(), "seat_images")  # 프로젝트 폴더 내 "seat_images"
os.makedirs(SEAT_IMAGE_FOLDER, exist_ok=True)  # 폴더 없으면 자동 생성
