FROM python:3.13.1-alpine

WORKDIR /app

COPY requirements.txt .

RUN pip install -r requirements.txt

RUN black .

COPY . .

RUN python manage.py migrate

CMD ["python", "manage.py", "runserver", "0.0.0.0:9999"]
