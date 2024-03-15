FROM python:latest

# Create app directory
WORKDIR /app

# Copy the files
COPY requirements.txt ./
COPY live_qa.py ./

#install the dependecies
RUN pip install --upgrade pip
RUN pip install -r requirements.txt

EXPOSE 8000
ENTRYPOINT ["uvicorn", "live_qa:app", "--reload", "--host", "0.0.0.0", "--port", "8000"]