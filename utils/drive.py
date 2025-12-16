import os
import json
import io
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from googleapiclient.http import MediaIoBaseDownload, MediaIoBaseUpload
from google.auth.exceptions import RefreshError
from dotenv import load_dotenv

load_dotenv()

SCOPES = ["https://www.googleapis.com/auth/drive"]
CREDENTIALS_FILE = "credentials.json"
TOKEN_FILE = "token.json"
ROOT_FOLDER_ID = os.getenv('DRIVE_ROOT_FOLDER_ID')

def get_drive_service():
    """Gets the Drive service, handling auth via user credentials."""
    creds = None
    if os.path.exists(TOKEN_FILE):
        creds = Credentials.from_authorized_user_file(TOKEN_FILE, SCOPES)
    
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            try:
                creds.refresh(Request())
            except RefreshError:
                print("Token expired or revoked. Re-authenticating...")
                creds = None # Trigger re-auth
        
        if not creds:
            if not os.path.exists(CREDENTIALS_FILE):
                raise FileNotFoundError(f"Missing {CREDENTIALS_FILE}")
            flow = InstalledAppFlow.from_client_secrets_file(
                CREDENTIALS_FILE, SCOPES
            )
            creds = flow.run_local_server(port=0, open_browser=False)
            print("Authentication URL:", flow.authorization_url()[0])
            
        with open(TOKEN_FILE, "w") as token:
            token.write(creds.to_json())
            
    return build("drive", "v3", credentials=creds)

def list_folder_content(folder_id=None):
    """Lists files and folders in a specific folder."""
    service = get_drive_service()
    
    if not folder_id or folder_id == "root":
        folder_id = ROOT_FOLDER_ID
        
    try:
        results = service.files().list(
            q=f"'{folder_id}' in parents and trashed=false",
            fields="files(id, name, mimeType, webViewLink, webContentLink)",
            orderBy="folder,name"
        ).execute()
        return results.get("files", [])
    except HttpError as e:
        print(f"An error occurred: {e}")
        return []

def get_file_metadata(file_id, fields="id, name, parents, mimeType"):
    """Gets metadata for a file or folder."""
    service = get_drive_service()
    try:
        file = service.files().get(fileId=file_id, fields=fields).execute()
        return file
    except HttpError as e:
        print(f"Error getting metadata for {file_id}: {e}")
        return None

def get_file_content(file_id):
    """Downloads file content (for JSON/Text)."""
    service = get_drive_service()
    try:
        request = service.files().get_media(fileId=file_id)
        file = io.BytesIO()
        downloader = MediaIoBaseDownload(file, request)
        done = False
        while done is False:
            status, done = downloader.next_chunk()
        return file.getvalue().decode('utf-8')
    except Exception as e:
        print(f"Error reading file {file_id}: {e}")
        return None

def create_folder(name, parent_id=None):
    """Creates a folder."""
    service = get_drive_service()
    
    if not parent_id or parent_id == "root":
        parent_id = ROOT_FOLDER_ID
        
    file_metadata = {
        'name': name,
        'mimeType': 'application/vnd.google-apps.folder',
        'parents': [parent_id]
    }
    try:
        file = service.files().create(body=file_metadata, fields='id').execute()
        return file.get('id')
    except HttpError as e:
        print(f"Error creating folder: {e}")
        return None

def update_file_content(file_id, content):
    """Updates a file's content (text/json)."""
    service = get_drive_service()
    try:
        media = MediaIoBaseUpload(io.BytesIO(content.encode('utf-8')), mimetype='application/json', resumable=True)
        service.files().update(fileId=file_id, media_body=media).execute()
        return True
    except HttpError as e:
        print(f"Error updating file: {e}")
        return False

def create_file(name, parent_id, content, mime_type='application/json'):
    """Creates a new file."""
    service = get_drive_service()
    
    if not parent_id or parent_id == "root":
        parent_id = ROOT_FOLDER_ID
        
    file_metadata = {
        'name': name,
        'parents': [parent_id]
    }
    try:
        media = MediaIoBaseUpload(io.BytesIO(content.encode('utf-8')), mimetype=mime_type, resumable=True)
        file = service.files().create(body=file_metadata, media_body=media, fields='id').execute()
        return file.get('id')
    except HttpError as e:
        print(f"Error creating file: {e}")
        return None

def make_file_public(file_id):
    """Makes a file public (reader permission for anyone)."""
    service = get_drive_service()
    try:
        permission = {
            'type': 'anyone',
            'role': 'reader',
        }
        service.permissions().create(
            fileId=file_id,
            body=permission,
            fields='id',
        ).execute()
        return True
    except HttpError as e:
        print(f"Error making file public: {e}")
        return False

def upload_file(file_storage, parent_id="root"):
    """Uploads a file (FileStorage) to Drive."""
    service = get_drive_service()
    
    if not parent_id or parent_id == "root":
        parent_id = ROOT_FOLDER_ID
        
    file_metadata = {
        'name': file_storage.filename,
        'parents': [parent_id]
    }
    try:
        # Create a MediaIoBaseUpload from the file stream
        media = MediaIoBaseUpload(file_storage.stream, mimetype=file_storage.mimetype, resumable=True)
        file = service.files().create(body=file_metadata, media_body=media, fields='id, webContentLink, mimeType').execute()
        
        # Check if it's an image and make it public
        if file.get('mimeType', '').startswith('image/'):
            make_file_public(file.get('id'))
            
        return file
    except HttpError as e:
        print(f"Error uploading file: {e}")
        return None

def rename_file(file_id, new_name):
    """Renames a file in Google Drive."""
    service = get_drive_service()
    try:
        file_metadata = {'name': new_name}
        service.files().update(fileId=file_id, body=file_metadata, fields='id, name').execute()
        return True
    except HttpError as e:
        print(f"Error renaming file {file_id} to {new_name}: {e}")
        return False

def get_all_folders():
    """Fetches ALL folders in the hierarchy to build a local tree."""
    service = get_drive_service()
    folders = []
    page_token = None
    
    try:
        while True:
            response = service.files().list(
                q="mimeType='application/vnd.google-apps.folder' and trashed=false",
                fields="nextPageToken, files(id, name, parents)",
                pageToken=page_token
            ).execute()
            
            folders.extend(response.get('files', []))
            page_token = response.get('nextPageToken')
            if not page_token:
                break
        return folders
    except HttpError as e:
        print(f"Error fetching all folders: {e}")
        return []