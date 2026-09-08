"""Load .env before anything else imports os.environ.

database.py and analytics.py read their settings at import time, and this package
initializer runs before any submodule, so this is the one place that guarantees a local
.env is in effect. On a hosting platform there is no .env file and the real environment
variables are used unchanged.
"""
from dotenv import load_dotenv

load_dotenv()
