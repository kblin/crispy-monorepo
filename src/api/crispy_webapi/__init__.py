from flask import Flask
from flask_cors import CORS

UPLOAD_PATH = "../uploads"

app = Flask(__name__)
app.config.from_object(__name__)
CORS(app)


import crispy_webapi.api
import crispy_webapi.error_handlers
