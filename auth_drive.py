from utils.drive import get_drive_service

if __name__ == "__main__":
    print("Authenticating with Google Drive...")
    try:
        service = get_drive_service()
        print("Authentication successful! token.json created.")
        
        # Test listing
        results = service.files().list(pageSize=5, fields="files(id, name)").execute()
        files = results.get('files', [])
        print("Files found:")
        for file in files:
            print(f"{file['name']} ({file['id']})")
            
    except Exception as e:
        print(f"Authentication failed: {e}")
