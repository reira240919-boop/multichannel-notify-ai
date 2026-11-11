"""
問い合わせ窓口の Gmail に「メールを読む許可」をもらい直し、.env.local の GMAIL_* を書きかえる。
鍵の値は画面に出さない。

  python3 scripts/gmail-auth.py <OAuth クライアントの credentials.json> <窓口のメールアドレス>

使うとき：
  - GMAIL_REFRESH_TOKEN が切れたとき（Google Cloud のアプリが「テスト中」だと約7日で切れる）
  - クライアントシークレットを取り替えたとき
  - 窓口メールのパスワードを変えたとき
必要なもの：pip install google-auth-oauthlib google-api-python-client
"""
import json
import os
import re
import sys
import warnings

warnings.filterwarnings("ignore")
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

CREDS, EMAIL = sys.argv[1], sys.argv[2]
ENV = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env.local")

flow = InstalledAppFlow.from_client_secrets_file(
    CREDS, scopes=["https://www.googleapis.com/auth/gmail.readonly"]
)
creds = flow.run_local_server(port=0, prompt="consent", access_type="offline", login_hint=EMAIL)

cfg = json.load(open(CREDS))["installed"]
new = {
    "GMAIL_CLIENT_ID": cfg["client_id"],
    "GMAIL_CLIENT_SECRET": cfg["client_secret"],
    "GMAIL_REFRESH_TOKEN": creds.refresh_token,
}

text = open(ENV, encoding="utf-8").read() if os.path.exists(ENV) else ""
for key, value in new.items():
    line = f"{key}={value}"
    if re.search(rf"^{key}=", text, re.M):
        text = re.sub(rf"^{key}=.*$", lambda _: line, text, flags=re.M)
    else:
        text += ("" if text.endswith("\n") or not text else "\n") + line + "\n"
open(ENV, "w", encoding="utf-8").write(text)

p = build("gmail", "v1", credentials=creds).users().getProfile(userId="me").execute()
print("つないだアカウント:", p["emailAddress"])
print(".env.local の GMAIL_* を書きかえました。本番は Vercel の値も書きかえてください。")
